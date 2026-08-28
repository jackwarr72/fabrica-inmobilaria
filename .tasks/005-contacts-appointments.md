# Task 005: Contactos y citas

## LLM Agent Directives

You are building the **contacts and appointments modules** of Centinela to achieve
the contact-management half of the operational flow: who owns/advertises each
property, and the weekly appointment machine that converts qualified opportunities
into meetings.

Lee primero `.tasks/CONTEXT.md` (secciones 3 y 4). El proyecto existe en `centinela/`
con las tareas 001–004 completas. Trabaja desde `centinela/`. Sigue los mismos
patrones establecidos en la tarea 004 (server actions + Zod + `useActionState`,
listados server-side con searchParams, `requireUser()` en cada página).

**Goals:**
1. CRUD de contactos (crear, listar con filtros, detalle, editar) con `lastContactAt`
2. Agenda de citas: crear, listar, completar/cancelar/no-show
3. Al agendar una cita con oportunidad, avanzar la oportunidad a estatus CITA
   (con registro en `StageHistory`) si viene de etapas previas
4. Contadores de apoyo a KPIs: contactos nuevos y citas de los últimos 7 días
5. Quality gates verdes al final

**Rules:**
- DO NOT modificar `prisma/schema.prisma` ni crear migraciones
- DO NOT construir dashboard, reportes diarios, alianzas ni ingestión (tareas 006–008)
- DO NOT borrar contactos ni citas físicamente
- DO NOT enviar notificaciones, correos, WhatsApp ni generar archivos de calendario
- DO NOT tocar auth, middleware, AppShell ni módulos de otras tareas
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio

---

## Phase 1: Extender etiquetas

**File:** `centinela/src/lib/labels.ts` (MODIFY)

FIND:
```typescript
import type {
  OperationType, OpportunityStatus, PropertyType, Qualification,
} from "@prisma/client";
```
CHANGE TO:
```typescript
import type {
  AppointmentStatus, ContactKind, OperationType, OpportunityStatus, PropertyType, Qualification,
} from "@prisma/client";
```

APPEND al final del archivo:
```typescript
export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  OWNER: "Propietario",
  BROKER: "Broker",
  ALLIANCE: "Aliado",
  OTHER: "Otro",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Programada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
};

export const APPOINTMENT_BADGE_VARIANT: Record<
  AppointmentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  SCHEDULED: "default",
  COMPLETED: "secondary",
  CANCELLED: "outline",
  NO_SHOW: "destructive",
};
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 2: Server actions de contactos

**File:** `centinela/src/app/(app)/contactos/actions.ts` (CREATE)
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { ContactKind } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

const contactSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  kind: z.nativeEnum(ContactKind),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  email: z.string().email("Correo inválido").optional(),
  socialHandle: z.string().optional(),
  zone: z.string().optional(),
  notes: z.string().optional(),
  assignedToId: z.string().optional(),
});

// Implementation note: consider normalizing phone numbers (strip spaces/`+`,
// store a canonical E.164 form if possible) or at least document expected
// formats for consistency when deduplicating/searching by phone.

function parseContactFormData(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return contactSchema.safeParse({
    name: raw.name,
    kind: raw.kind,
    phone: emptyToUndefined(raw.phone),
    phone2: emptyToUndefined(raw.phone2),
    email: emptyToUndefined(raw.email),
    socialHandle: emptyToUndefined(raw.socialHandle),
    zone: emptyToUndefined(raw.zone),
    notes: emptyToUndefined(raw.notes),
    assignedToId: emptyToUndefined(raw.assignedToId),
  });
}

export async function createContactAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData,
): Promise<{ error: string | null; id: string | null }> {
  await requireUser();
  const parsed = parseContactFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", id: null };
  }
  const contact = await prisma.contact.create({ data: parsed.data });
  revalidatePath("/contactos");
  return { error: null, id: contact.id };
}

export async function updateContactAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData,
): Promise<{ error: string | null; id: string | null }> {
  await requireUser();
  const contactId = String(formData.get("contactId") ?? "");
  if (!contactId) return { error: "Contacto inválido", id: null };

  const parsed = parseContactFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", id: null };
  }
  await prisma.contact.update({ where: { id: contactId }, data: parsed.data });
  revalidatePath(`/contactos/${contactId}`);
  revalidatePath("/contactos");
  return { error: null, id: contactId };
}

export async function registerTouchAction(contactId: string): Promise<void> {
  await requireUser();
  await prisma.contact.update({
    where: { id: contactId },
    data: { lastContactAt: new Date() },
  });
  revalidatePath(`/contactos/${contactId}`);
  revalidatePath("/contactos");
}
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 3: Formulario de contacto (crear y editar)

**File:** `centinela/src/app/(app)/contactos/contact-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_KIND_LABELS } from "@/lib/labels";
import { createContactAction, updateContactAction } from "./actions";

type UserOption = { id: string; name: string };
export type ContactInitial = {
  name: string; kind: string; phone: string; phone2: string; email: string;
  socialHandle: string; zone: string; notes: string; assignedToId: string;
};

export function ContactForm({ users, contactId, initial, currentUserId }: {
  users: UserOption[];
  contactId?: string;
  initial?: ContactInitial;
  currentUserId: string;
}) {
  const router = useRouter();
  const action = contactId ? updateContactAction : createContactAction;
  const [state, formAction, pending] = useActionState(action, {
    error: null as string | null,
    id: null as string | null,
  });

  useEffect(() => {
    if (state?.id && !contactId) router.push(`/contactos/${state.id}`);
  }, [state?.id, contactId, router]);

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      {contactId ? <input type="hidden" name="contactId" value={contactId} /> : null}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="name">Nombre *</Label>
        <Input id="name" name="name" required minLength={2} defaultValue={initial?.name} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="kind">Tipo *</Label>
        <select id="kind" name="kind" required defaultValue={initial?.kind ?? "OWNER"}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          {Object.entries(CONTACT_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignedToId">Asignado a</Label>
        <select id="assignedToId" name="assignedToId"
          defaultValue={initial?.assignedToId || currentUserId}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" name="phone" defaultValue={initial?.phone} placeholder="722…" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone2">Teléfono 2</Label>
        <Input id="phone2" name="phone2" defaultValue={initial?.phone2} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" defaultValue={initial?.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="socialHandle">Red social / WhatsApp</Label>
        <Input id="socialHandle" name="socialHandle" defaultValue={initial?.socialHandle}
          placeholder="@usuario" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="zone">Zona</Label>
        <Input id="zone" name="zone" defaultValue={initial?.zone} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" defaultValue={initial?.notes} />
      </div>

      {state?.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
      {contactId && !state?.error && state?.id ? (
        <p className="text-sm text-green-600 sm:col-span-2">Contacto actualizado.</p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Guardando…" : contactId ? "Guardar cambios" : "Crear contacto"}
        </Button>
      </div>
    </form>
  );
}
```

### 3.1 Página de creación

**File:** `centinela/src/app/(app)/contactos/nueva/page.tsx` (CREATE)
```tsx
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ContactForm } from "../contact-form";

export default async function NewContactPage() {
  const user = await requireUser();
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo contacto</h1>
        <p className="text-sm text-muted-foreground">
          Propietarios, brokers y aliados detectados en la prospección.
        </p>
      </div>
      <ContactForm users={users} currentUserId={user.id} />
    </div>
  );
}
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 4: Listado de contactos

**File:** `centinela/src/app/(app)/contactos/page.tsx` (REPLACE)

Server component siguiendo el patrón del listado de la tarea 004. Requisitos:

```tsx
// searchParams: Promise<Record<string, string | string[] | undefined>>
// Filtros: kind (validado contra CONTACT_KIND_LABELS) y q
//   (q → OR contains insensitive sobre name, phone y email)
// Datos: prisma.contact.findMany({
//   where, include: { assignedTo: true },
//   orderBy: { createdAt: "desc" }, skip/take PAGE_SIZE = 20
// }) + count; usa include _count: { select: { opportunities: true } }
// Header: título + "N nuevos en los últimos 7 días"
//   (count con createdAt >= ahora - 7 días) + botón "+ Nuevo contacto"
// Barra de filtros: componente client pequeño (contactos/filters.tsx) con
//   select de tipo + input de búsqueda, envuelto en <Suspense>
// Tabla: Nombre (Link al detalle), Tipo (CONTACT_KIND_LABELS), Teléfono,
//   Correo, Red social, Zona, Oportunidades (_count), Último contacto
//   (formatDateTime o "—"), Asignado a
// Estado vacío + paginación Anterior/Siguiente conservando filtros
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 5: Detalle de contacto, "marcar contactado" y edición

### 5.1 Botón "Marcar contactado" (client)

**File:** `centinela/src/app/(app)/contactos/touch-button.tsx` (CREATE)
```tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { registerTouchAction } from "./actions";

export function TouchButton({ contactId }: { contactId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(() => registerTouchAction(contactId))}
    >
      {pending ? "Registrando…" : "Marcar contactado"}
    </Button>
  );
}
```

### 5.2 Página de detalle

**File:** `centinela/src/app/(app)/contactos/[id]/page.tsx` (CREATE)

Server component:
```tsx
// params: Promise<{ id: string }> — await params
// contact = findUnique include:
//   assignedTo,
//   opportunities: { orderBy: { createdAt: "desc" }, take: 10 },
//   appointments: { orderBy: { scheduledAt: "desc" }, take: 10 }
// notFound() si no existe
// JSX:
// - Header: nombre + Badge con CONTACT_KIND_LABELS + <TouchButton /> +
//   <Button asChild variant="outline"><Link href={`/contactos/${id}/editar`}>Editar</Link></Button>
// - Card "Datos": teléfonos, correo, red social, zona, asignado a,
//   último contacto (formatDateTime o "Nunca"), notas
// - Card "Oportunidades relacionadas": filas con Link a /oportunidades/[id],
//   título + Badge de estatus + fecha; vacío → "Sin oportunidades asociadas."
// - Card "Citas": filas con fecha (formatDateTime) + Badge
//   APPOINTMENT_STATUS_LABELS/APPOINTMENT_BADGE_VARIANT + título de oportunidad;
//   vacío → "Sin citas registradas."
```

### 5.3 Página de edición

**File:** `centinela/src/app/(app)/contactos/[id]/editar/page.tsx` (CREATE)
```tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ContactForm, type ContactInitial } from "../../contact-form";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) notFound();

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const initial: ContactInitial = {
    name: contact.name,
    kind: contact.kind,
    phone: contact.phone ?? "",
    phone2: contact.phone2 ?? "",
    email: contact.email ?? "",
    socialHandle: contact.socialHandle ?? "",
    zone: contact.zone ?? "",
    notes: contact.notes ?? "",
    assignedToId: contact.assignedToId ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar contacto</h1>
        <p className="text-sm text-muted-foreground">{contact.name}</p>
      </div>
      <ContactForm users={users} contactId={id} initial={initial} currentUserId={user.id} />
    </div>
  );
}
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 6: Server actions de citas

**File:** `centinela/src/app/(app)/citas/actions.ts` (CREATE)
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

const createSchema = z.object({
  opportunityId: z.string().optional(),
  contactId: z.string().optional(),
  locationOrUrl: z.string().max(500).optional(),
  notes: z.string().optional(),
});

export async function createAppointmentAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData,
): Promise<{ error: string | null; id: string | null }> {
  const user = await requireUser();

  const scheduledAt = new Date(String(formData.get("scheduledAt") ?? ""));
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: "Selecciona fecha y hora válidas.", id: null };
  }

  const parsed = createSchema.safeParse({
    opportunityId: emptyToUndefined(formData.get("opportunityId")),
    contactId: emptyToUndefined(formData.get("contactId")),
    locationOrUrl: emptyToUndefined(formData.get("locationOrUrl")),
    notes: emptyToUndefined(formData.get("notes")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", id: null };
  }
  const data = parsed.data;

  const appointment = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.create({
      data: {
        opportunityId: data.opportunityId,
        contactId: data.contactId,
        userId: user.id,
        scheduledAt,
        locationOrUrl: data.locationOrUrl,
        notes: data.notes,
      },
    });

    // La oportunidad avanza a CITA si viene de etapas previas
    if (data.opportunityId) {
      const opp = await tx.opportunity.findUnique({ where: { id: data.opportunityId } });
      const advanceable =
        opp &&
        ["DETECTED", "REGISTERED", "VALIDATING", "QUALIFIED", "CONTACTED"].includes(opp.status);
      if (advanceable) {
        await tx.opportunity.update({
          where: { id: opp.id },
          data: { status: "APPOINTMENT" },
        });
        await tx.stageHistory.create({
          data: {
            opportunityId: opp.id,
            fromStatus: opp.status,
            toStatus: "APPOINTMENT",
            note: "Cita agendada",
            userId: user.id,
          },
        });
      }
    }
    return appt;
  });

  revalidatePath("/citas");
  revalidatePath("/oportunidades");
  if (data.opportunityId) revalidatePath(`/oportunidades/${data.opportunityId}`);
  return { error: null, id: appointment.id };
}

export async function setAppointmentStatusAction(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<void> {
  await requireUser();
  const current = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!current || current.status !== "SCHEDULED") return;

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status },
  });
  revalidatePath("/citas");
}
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 7: Nueva cita

### 7.1 Formulario (client)

**File:** `centinela/src/app/(app)/citas/nueva/appointment-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAppointmentAction } from "../actions";

type OpportunityOption = { id: string; name: string; contactId: string | null };
type ContactOption = { id: string; name: string };

export function AppointmentForm({ opportunities, contacts }: {
  opportunities: OpportunityOption[];
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [contactId, setContactId] = useState("");
  const [state, formAction, pending] = useActionState(createAppointmentAction, {
    error: null as string | null,
    id: null as string | null,
  });

  useEffect(() => {
    if (state?.id) router.push("/citas");
  }, [state?.id, router]);

  function onOpportunityChange(value: string) {
    const opp = opportunities.find((o) => o.id === value);
    if (opp?.contactId) setContactId(opp.contactId);
  }

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="opportunityId">Oportunidad</Label>
        <select id="opportunityId" name="opportunityId" defaultValue=""
          onChange={(e) => onOpportunityChange(e.target.value)}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Sin oportunidad</option>
          {opportunities.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactId">Contacto</Label>
        <select id="contactId" name="contactId" value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Sin contacto</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scheduledAt">Fecha y hora *</Label>
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="locationOrUrl">Lugar o liga de videollamada</Label>
        <Input id="locationOrUrl" name="locationOrUrl" placeholder="Dirección o https://meet…" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" />
      </div>

      {state?.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Agendando…" : "Agendar cita"}
        </Button>
      </div>
    </form>
  );
}
```

### 7.2 Página

**File:** `centinela/src/app/(app)/citas/nueva/page.tsx` (CREATE)
```tsx
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { AppointmentForm } from "./appointment-form";

export default async function NewAppointmentPage() {
  await requireUser();
  const [opportunities, contacts] = await Promise.all([
    prisma.opportunity.findMany({
      where: { status: { not: "DISCARDED" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, zone: true, contactId: true },
    }),
    prisma.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const opportunityOptions = opportunities.map((o) => ({
    id: o.id,
    name: `${o.title}${o.zone ? ` — ${o.zone}` : ""}`,
    contactId: o.contactId,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nueva cita</h1>
        <p className="text-sm text-muted-foreground">
          Si la oportunidad viene de etapas previas, avanzará automáticamente a “Cita”.
        </p>
      </div>
      <AppointmentForm opportunities={opportunityOptions} contacts={contacts} />
    </div>
  );
}
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 8: Listado de citas con acciones

### 8.1 Acciones de estatus (client)

**File:** `centinela/src/app/(app)/citas/status-actions.tsx` (CREATE)
```tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setAppointmentStatusAction } from "./actions";

export function AppointmentStatusActions({ appointmentId }: { appointmentId: string }) {
  const [pending, startTransition] = useTransition();

  function set(status: "COMPLETED" | "CANCELLED" | "NO_SHOW") {
    startTransition(() => setAppointmentStatusAction(appointmentId, status));
  }

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" disabled={pending} title="Completada"
        onClick={() => set("COMPLETED")}>✓</Button>
      <Button size="sm" variant="outline" disabled={pending} title="No asistió"
        onClick={() => set("NO_SHOW")}>✗</Button>
      <Button size="sm" variant="ghost" disabled={pending} title="Cancelar cita"
        onClick={() => set("CANCELLED")}>Cancelar</Button>
    </div>
  );
}
```

### 8.2 Reemplazar la página placeholder

**File:** `centinela/src/app/(app)/citas/page.tsx` (REPLACE)

Server component siguiendo el patrón de listados de la tarea 004. Requisitos:

```tsx
// searchParams: status (validado contra APPOINTMENT_STATUS_LABELS) + page
// Datos: prisma.appointment.findMany({
//   where, include: { opportunity: true, contact: true, user: true },
//   orderBy: { scheduledAt: "desc" }, skip/take PAGE_SIZE = 20
// }) + count
// Header: título + "N citas en los últimos 7 días"
//   (count con scheduledAt >= ahora - 7 días) + botón "+ Nueva cita"
// Filtro: componente client pequeño con select de estatus (citas/filters.tsx),
//   envuelto en <Suspense>
// Tabla: Fecha (formatDateTime), Oportunidad (Link al detalle o "—"),
//   Contacto (Link o "—"), Asesor (user.name), Lugar/liga,
//   Estatus (Badge con APPOINTMENT_BADGE_VARIANT),
//   Acciones (<AppointmentStatusActions /> solo si status === "SCHEDULED")
// Estado vacío + paginación
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 9: Gates, commit y verify final

RUN:
```bash
pnpm typecheck
pnpm lint
pnpm build
git add -A && git commit -m "feat: contacts and appointments (task 005)"
```

RUN (verificación de runtime):
```bash
docker compose up -d
pnpm dev &
sleep 8
curl -sI http://localhost:3000/contactos | head -5   # 3xx hacia /login sin sesión
curl -sI http://localhost:3000/citas | head -5       # 3xx hacia /login sin sesión
```

Si tienes navegador disponible, verifica con sesión: crear contacto → aparece en el
listado → editar → "Marcar contactado" actualiza la fecha → agendar cita con una
oportunidad → la oportunidad queda en estatus "Cita" con entrada en su historial.

Anota en el resumen final cualquier verificación manual que no pudiste ejecutar.

---

## Checklist

### Phase 1
- [ ] `labels.ts` extendido con contactos y citas
- [ ] `pnpm typecheck` pasa

### Phase 2
- [ ] Actions de contactos: create / update / registerTouch

### Phase 3
- [ ] `ContactForm` reutilizado para crear y editar
- [ ] `/contactos/nueva` funciona

### Phase 4
- [ ] Listado con filtro de tipo, búsqueda y paginación
- [ ] Contador "nuevos últimos 7 días"

### Phase 5
- [ ] Detalle con oportunidades y citas relacionadas
- [ ] "Marcar contactado" y edición funcionando

### Phase 6
- [ ] Actions de citas con avance automático de oportunidad a CITA
- [ ] `StageHistory` registra el avance

### Phase 7
- [ ] `/citas/nueva` auto-rellena contacto desde la oportunidad

### Phase 8
- [ ] Listado de citas con acciones completar/no-show/cancelar
- [ ] Contador "citas últimos 7 días"

### Phase 9
- [ ] `pnpm typecheck && pnpm lint && pnpm build` ✅
- [ ] Commit `feat: contacts and appointments (task 005)`

---

## Do NOT Do

- Do NOT tocar `prisma/schema.prisma` ni generar migraciones
- Do NOT borrar contactos ni citas físicamente
- Do NOT construir el dashboard ni reportes diarios (tarea 006)
- Do NOT importar CSV ni conectores de ingestión (tarea 007)
- Do NOT construir el tracker de alianzas (tarea 008)
- Do NOT enviar correos, WhatsApp, recordatorios ni generar iCal
- Do NOT agregar calendario visual mensual/semanal
- Do NOT modificar auth, middleware, AppShell ni los módulos de tareas previas
