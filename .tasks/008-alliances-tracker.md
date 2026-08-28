# Task 008: Tracker de alianzas estratégicas

## LLM Agent Directives

You are building the **strategic alliances tracker** of Centinela to achieve the
relationship layer of the prospecting machine: brokers, desarrolladores, notarios,
arquitectos, abogados y valuadores — with interaction logging and a cadence
indicator enforcing the "contact at least twice a week" rule from the brief.

Lee primero `.tasks/CONTEXT.md` (secciones 1 y 4). El proyecto existe en `centinela/`
con las tareas 001–007 completas. Trabaja desde `centinela/`. Sigue los patrones
establecidos en las tareas 004/005 (server actions + Zod + `useActionState`,
listados server-side con searchParams, formulario único crear/editar).

**Goals:**
1. CRUD de alianzas (crear, listar con filtros, detalle, editar) sin borrado físico
2. Registro de interacciones (canal + nota) desde el detalle de cada alianza
3. Semáforo de cadencia por alianza según la regla "2 interacciones por semana"
4. Contador de interacciones de los últimos 7 días en el header
5. Quality gates verdes al final

**Rules:**
- DO NOT modificar `prisma/schema.prisma` ni crear migraciones
- DO NOT borrar alianzas ni interacciones físicamente
- DO NOT enviar recordatorios, correos ni notificaciones
- DO NOT tocar el dashboard, reportes ni los demás módulos
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio

---

## Phase 1: Etiquetas de tipos de alianza

**File:** `centinela/src/lib/labels.ts` (MODIFY)

FIND (la línea de importación de tipos de Prisma; puede incluir ya varios tipos):
```typescript
import type {
  AppointmentStatus, ContactKind, OperationType, OpportunityStatus, PropertyType, Qualification,
} from "@prisma/client";
```
CHANGE TO (agrega `AllianceType` conservando el orden alfabético):
```typescript
import type {
  AllianceType, AppointmentStatus, ContactKind, OperationType, OpportunityStatus, PropertyType, Qualification,
} from "@prisma/client";
```

APPEND al final del archivo:
```typescript
export const ALLIANCE_TYPE_LABELS: Record<AllianceType, string> = {
  BROKER: "Broker",
  DEVELOPER: "Desarrollador",
  NOTARY: "Notario",
  ARCHITECT: "Arquitecto",
  LAWYER: "Abogado",
  APPRAISER: "Valuador",
  OTHER: "Otro",
};
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 2: Server actions de alianzas

**File:** `centinela/src/app/(app)/alianzas/actions.ts` (CREATE)
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { AllianceType } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

const allianceSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  type: z.nativeEnum(AllianceType),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Correo inválido").optional(),
  zone: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean(),
});

function parseAllianceFormData(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return allianceSchema.safeParse({
    name: raw.name,
    type: raw.type,
    company: emptyToUndefined(raw.company),
    phone: emptyToUndefined(raw.phone),
    email: emptyToUndefined(raw.email),
    zone: emptyToUndefined(raw.zone),
    notes: emptyToUndefined(raw.notes),
    isActive: formData.get("isActive") === "on",
  });
}

export async function createAllianceAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData,
): Promise<{ error: string | null; id: string | null }> {
  await requireUser();
  const parsed = parseAllianceFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", id: null };
  }
  const alliance = await prisma.alliance.create({ data: parsed.data });
  revalidatePath("/alianzas");
  return { error: null, id: alliance.id };
}

export async function updateAllianceAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData,
): Promise<{ error: string | null; id: string | null }> {
  await requireUser();
  const allianceId = String(formData.get("allianceId") ?? "");
  if (!allianceId) return { error: "Alianza inválida", id: null };

  const parsed = parseAllianceFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", id: null };
  }
  await prisma.alliance.update({ where: { id: allianceId }, data: parsed.data });
  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/alianzas");
  return { error: null, id: allianceId };
}

export async function logInteractionAction(
  _prev: { error: string | null; done: boolean },
  formData: FormData,
): Promise<{ error: string | null; done: boolean }> {
  const user = await requireUser();

  const parsed = z
    .object({
      allianceId: z.string(),
      channel: z.string().min(1, "Selecciona un canal"),
      notes: z.string().optional(),
    })
    .safeParse({
      allianceId: formData.get("allianceId"),
      channel: formData.get("channel"),
      notes: emptyToUndefined(formData.get("notes")),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", done: false };
  }
  const { allianceId, channel, notes } = parsed.data;

  await prisma.allianceInteraction.create({
    data: {
      allianceId,
      userId: user.id,
      channel,
      notes,
      date: new Date(), // siempre en servidor
    },
  });

  revalidatePath(`/alianzas/${allianceId}`);
  revalidatePath("/alianzas");
  return { error: null, done: true };
}
```

VERIFY: `pnpm typecheck` pasa.

Implementation notes:
- Cadence thresholds (explicit): 2+ interactions in the last 7 days → status `Al día`; 1 interaction → `En riesgo`; 0 interactions and last interaction older than 14 days → `Sin contacto` (or `Fría` if last interaction within 14 days per the spec). Make these thresholds constants so tests and UI use the same logic.

---

## Phase 3: Formulario de alianza (crear y editar)

**File:** `centinela/src/app/(app)/alianzas/alliance-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ALLIANCE_TYPE_LABELS } from "@/lib/labels";
import { createAllianceAction, updateAllianceAction } from "./actions";

export type AllianceInitial = {
  name: string; type: string; company: string; phone: string; email: string;
  zone: string; notes: string; isActive: boolean;
};

export function AllianceForm({ allianceId, initial }: {
  allianceId?: string;
  initial?: AllianceInitial;
}) {
  const router = useRouter();
  const action = allianceId ? updateAllianceAction : createAllianceAction;
  const [state, formAction, pending] = useActionState(action, {
    error: null as string | null,
    id: null as string | null,
  });

  useEffect(() => {
    if (state?.id && !allianceId) router.push(`/alianzas/${state.id}`);
  }, [state?.id, allianceId, router]);

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      {allianceId ? <input type="hidden" name="allianceId" value={allianceId} /> : null}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="name">Nombre *</Label>
        <Input id="name" name="name" required minLength={2} defaultValue={initial?.name} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Tipo *</Label>
        <select id="type" name="type" required defaultValue={initial?.type ?? "BROKER"}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          {Object.entries(ALLIANCE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Empresa / despacho</Label>
        <Input id="company" name="company" defaultValue={initial?.company} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" name="phone" defaultValue={initial?.phone} placeholder="722…" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" defaultValue={initial?.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="zone">Zona de influencia</Label>
        <Input id="zone" name="zone" defaultValue={initial?.zone} />
      </div>

      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" className="h-4 w-4"
            defaultChecked={initial ? initial.isActive : true} />
          Alianza activa
        </label>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" defaultValue={initial?.notes} />
      </div>

      {state?.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
      {allianceId && !state?.error && state?.id ? (
        <p className="text-sm text-green-600 sm:col-span-2">Alianza actualizada.</p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Guardando…" : allianceId ? "Guardar cambios" : "Crear alianza"}
        </Button>
      </div>
    </form>
  );
}
```

### 3.1 Página de creación

**File:** `centinela/src/app/(app)/alianzas/nueva/page.tsx` (CREATE)
```tsx
import { requireUser } from "@/lib/guards";
import { AllianceForm } from "../alliance-form";

export default async function NewAlliancePage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nueva alianza</h1>
        <p className="text-sm text-muted-foreground">
          Brokers, desarrolladores, notarios, arquitectos, abogados y valuadores.
          Meta: contacto mínimo dos veces por semana.
        </p>
      </div>
      <AllianceForm />
    </div>
  );
}
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 4: Listado con cadencia

### 4.1 Barra de filtros (client)

**File:** `centinela/src/app/(app)/alianzas/filters.tsx` (CREATE)

Sigue exactamente el patrón de `oportunidades/filters.tsx` (tarea 004):
función `pushParam` + un `FilterSelect` con `ALLIANCE_TYPE_LABELS` (param `type`)
+ input de búsqueda (param `q`, aplica con Enter) + botón "Limpiar" que va a `/alianzas`.

### 4.2 Reemplazar la página placeholder

**File:** `centinela/src/app/(app)/alianzas/page.tsx` (REPLACE)

Server component siguiendo el patrón de listados de la tarea 004:

```tsx
// Constantes: DAY_MS = 24*3600*1000; weekAgo = ahora - 7 días; PAGE_SIZE = 20

// Función local de cadencia:
function cadenceInfo(count7: number, lastDate: Date | null) {
  if (count7 >= 2) return { label: "Al día", variant: "default" as const };
  if (count7 === 1) return { label: "En riesgo", variant: "secondary" as const };
  if (lastDate && Date.now() - lastDate.getTime() <= 14 * DAY_MS) {
    return { label: "Fría", variant: "outline" as const };
  }
  return { label: "Sin contacto", variant: "destructive" as const };
}

// searchParams: type (validado contra ALLIANCE_TYPE_LABELS) + q
//   (q → OR contains insensitive sobre name, company y zone) + page
// Datos:
//   - Contador del header: allianceInteraction.count({ where: { date: { gte: weekAgo } } })
//   - $transaction([
//       alliance.findMany({
//         where,
//         include: {
//           interactions: { orderBy: { date: "desc" }, take: 1 },
//           _count: { select: { interactions: { where: { date: { gte: weekAgo } } } } },
//         },
//         orderBy: { createdAt: "desc" }, skip/take
//       }),
//       alliance.count({ where }),
//     ])
// JSX:
// - Header: título + "N alianzas · M interacciones en los últimos 7 días"
//   + botón "+ Nueva alianza"
// - <Suspense fallback={null}><AllianceFilters /></Suspense>
// - Tabla: Nombre (Link al detalle), Tipo (ALLIANCE_TYPE_LABELS), Empresa,
//   Teléfono, Zona, Última interacción (interactions[0]?.date con formatDateTime o "—"),
//   Semana ("X/2" con _count), Cadencia (Badge según cadenceInfo),
//   Activa (✓ / —)
// - Estado vacío + paginación Anterior/Siguiente conservando filtros
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 5: Detalle e interacciones

### 5.1 Formulario de interacción (client)

**File:** `centinela/src/app/(app)/alianzas/log-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logInteractionAction } from "./actions";

const CHANNELS = ["Llamada", "WhatsApp", "Presencial", "Email", "Otro"];

export function LogInteractionForm({ allianceId }: { allianceId: string }) {
  const [state, formAction, pending] = useActionState(logInteractionAction, {
    error: null as string | null,
    done: false,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="allianceId" value={allianceId} />
      <div className="space-y-2">
        <Label htmlFor="channel">Canal</Label>
        <select id="channel" name="channel" required defaultValue="Llamada"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Nota</Label>
        <Textarea id="notes" name="notes"
          placeholder="Ej. me avisó de una casa que van a listar el próximo mes…" />
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.done ? <p className="text-sm text-green-600">Interacción registrada.</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Registrando…" : "Registrar interacción"}
      </Button>
    </form>
  );
}
```

### 5.2 Página de detalle

**File:** `centinela/src/app/(app)/alianzas/[id]/page.tsx` (CREATE)

Server component:
```tsx
// params: Promise<{ id: string }> — await params
// alliance = findUnique include:
//   interactions: { orderBy: { date: "desc" }, take: 30, include: { user: true } }
// notFound() si no existe
// JSX (grid de 3 columnas en lg, contenido principal ocupa 2):
// - Header: nombre + Badge con ALLIANCE_TYPE_LABELS + Badge "Activa"/"Inactiva"
//   + botón Editar (Link a /alianzas/{id}/editar, variant outline)
// - Card "Datos": empresa, teléfono, correo, zona, notas
// - Card "Interacciones recientes" (línea de tiempo): canal + nota + usuario
//   (user?.name o "—") + formatDateTime(date); vacío → "Sin interacciones registradas."
// - Columna derecha: Card "Registrar interacción" con <LogInteractionForm />
```

### 5.3 Página de edición

**File:** `centinela/src/app/(app)/alianzas/[id]/editar/page.tsx` (CREATE)
```tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { AllianceForm, type AllianceInitial } from "../../alliance-form";

export default async function EditAlliancePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const alliance = await prisma.alliance.findUnique({ where: { id } });
  if (!alliance) notFound();

  const initial: AllianceInitial = {
    name: alliance.name,
    type: alliance.type,
    company: alliance.company ?? "",
    phone: alliance.phone ?? "",
    email: alliance.email ?? "",
    zone: alliance.zone ?? "",
    notes: alliance.notes ?? "",
    isActive: alliance.isActive,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar alianza</h1>
        <p className="text-sm text-muted-foreground">{alliance.name}</p>
      </div>
      <AllianceForm allianceId={id} initial={initial} />
    </div>
  );
}
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 6: Gates, commit y verify final

RUN:
```bash
pnpm typecheck
pnpm lint
pnpm build
git add -A && git commit -m "feat: alliances tracker and cadence (task 008)"
```

RUN (verificación de runtime):
```bash
docker compose up -d
pnpm dev &
sleep 8
curl -sI http://localhost:3000/alianzas | head -5   # 3xx hacia /login sin sesión
```

Si tienes navegador disponible, verifica con sesión: crear alianza → aparece en el
listado como "Sin contacto" → registrar dos interacciones → cadencia cambia a
"Al día" → editar y desactivar → queda como "Inactiva".

Anota en el resumen final cualquier verificación manual que no pudiste ejecutar.

---

## Checklist

### Phase 1
- [ ] `ALLIANCE_TYPE_LABELS` agregado a `labels.ts`

### Phase 2
- [ ] Actions: create / update / logInteraction
- [ ] Fecha de interacción siempre desde servidor

### Phase 3
- [ ] `AllianceForm` reutilizado para crear y editar
- [ ] `/alianzas/nueva` funciona

### Phase 4
- [ ] Listado con filtro de tipo, búsqueda y paginación
- [ ] Semáforo de cadencia (Al día / En riesgo / Fría / Sin contacto)
- [ ] Contador de interacciones de 7 días en el header

### Phase 5
- [ ] Detalle con datos + línea de tiempo de interacciones
- [ ] Registro de interacción funcional
- [ ] Edición con toggle de activa/inactiva

### Phase 6
- [ ] `pnpm typecheck && pnpm lint && pnpm build` ✅
- [ ] Commit `feat: alliances tracker and cadence (task 008)`

---

## Do NOT Do

- Do NOT tocar `prisma/schema.prisma` ni generar migraciones
- Do NOT borrar alianzas ni interacciones físicamente
- Do NOT enviar recordatorios, correos, WhatsApp ni notificaciones push
- Do NOT modificar el dashboard, reportes ni otros módulos
- Do NOT generar oportunidades desde alianzas automáticamente
- Do NOT editar la fecha de las interacciones manualmente (siempre es "ahora")
