# Task 004: CRUD de oportunidades y pipeline

## LLM Agent Directives

You are building the **opportunities module** of Centinela to achieve the core
operational loop: register detected properties, move them through the pipeline
stages, qualify them, and track every transition.

Lee primero `.tasks/CONTEXT.md` (secciones 3 y 4). El proyecto existe en `centinela/`
con las tareas 001–003 completas (scaffold, schema, auth). Trabaja desde `centinela/`.
Las rutas viven en `src/app/(app)/` (grupo protegido de la tarea 003).

**Goals:**
1. Registrar oportunidades (formulario validado con Zod + server action)
2. Listado con filtros (estatus, tipo, operación, calificación, búsqueda) y paginación
3. Página de detalle con datos completos, historial de etapas y cambios de precio
4. Cambio de estatus transaccional que escribe en `StageHistory` y fija `firstContactAt`
5. Calificación ALTA/MEDIA/BAJA con avance automático de etapa
6. Indicador visual del SLA de contacto (< 24h)
7. Quality gates verdes al final

**Rules:**
- DO NOT modificar `prisma/schema.prisma` ni crear migraciones
- DO NOT construir módulos de contactos, citas, alianzas o dashboard (tareas 005/006)
- DO NOT implementar edición masiva ni borrado físico de oportunidades
- DO NOT tocar auth, middleware, AppShell ni el layout raíz
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio

---

## Phase 1: Utilidades compartidas

### 1.1 Etiquetas en español para enums

**File:** `centinela/src/lib/labels.ts` (CREATE)
```typescript
import type {
  OperationType, OpportunityStatus, PropertyType, Qualification,
} from "@prisma/client";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: "Casa",
  APARTMENT: "Departamento",
  LAND: "Terreno",
  COMMERCIAL: "Local comercial",
  WAREHOUSE: "Bodega",
  DEVELOPMENT: "Desarrollo",
  INVESTMENT: "Inversión",
  OTHER: "Otro",
};

export const OPERATION_LABELS: Record<OperationType, string> = {
  SALE: "Venta",
  RENT: "Renta",
};

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  DETECTED: "Detectada",
  REGISTERED: "Registrada",
  VALIDATING: "Validando",
  QUALIFIED: "Calificada",
  CONTACTED: "Contactada",
  APPOINTMENT: "Cita",
  DOCUMENTATION: "Documentación",
  INVENTORY: "Inventario",
  FOLLOW_UP: "Seguimiento",
  DISCARDED: "Descartada",
};

export const QUALIFICATION_LABELS: Record<Qualification, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

export const STATUS_BADGE_VARIANT: Record<
  OpportunityStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DETECTED: "outline",
  REGISTERED: "secondary",
  VALIDATING: "secondary",
  QUALIFIED: "default",
  CONTACTED: "default",
  APPOINTMENT: "default",
  DOCUMENTATION: "secondary",
  INVENTORY: "default",
  FOLLOW_UP: "outline",
  DISCARDED: "destructive",
};
```

### 1.2 Formateo

**File:** `centinela/src/lib/format.ts` (CREATE)
```typescript
export function formatMoney(value: unknown): string {
  if (value == null) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function hoursBetween(a: Date, b: Date): number {
  return Math.round(((b.getTime() - a.getTime()) / 3_600_000) * 10) / 10;
}
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 2: Server actions del módulo

**File:** `centinela/src/app/(app)/oportunidades/actions.ts` (CREATE)
```typescript
"use server";

import { revalidatePath } from "next/cache";
import {
  OpportunityStatus, OperationType, PropertyType, Qualification,
} from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

// ─── Crear oportunidad ────────────────────────────────────

const createSchema = z.object({
  title: z.string().min(5, "El título debe tener al menos 5 caracteres"),
  description: z.string().optional(),
  propertyType: z.nativeEnum(PropertyType),
  operation: z.nativeEnum(OperationType),
  price: z.coerce.number().positive("El precio debe ser mayor a cero").optional(),
  zone: z.string().optional(),
  address: z.string().optional(),
  sourceUrl: z.string().url("La liga debe ser una URL válida").optional(),
  sourceNotes: z.string().optional(),
  sourceId: z.string().optional(),
  contactId: z.string().optional(),
});

export async function createOpportunityAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData,
): Promise<{ error: string | null; id: string | null }> {
  const user = await requireUser();
  const raw = Object.fromEntries(formData);

  const parsed = createSchema.safeParse({
    title: raw.title,
    description: emptyToUndefined(raw.description),
    propertyType: raw.propertyType,
    operation: raw.operation,
    price: emptyToUndefined(raw.price),
    zone: emptyToUndefined(raw.zone),
    address: emptyToUndefined(raw.address),
    sourceUrl: emptyToUndefined(raw.sourceUrl),
    sourceNotes: emptyToUndefined(raw.sourceNotes),
    sourceId: emptyToUndefined(raw.sourceId),
    contactId: emptyToUndefined(raw.contactId),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", id: null };
  }
  const data = parsed.data;

  const opportunity = await prisma.$transaction(async (tx) => {
    const opp = await tx.opportunity.create({
      data: {
        title: data.title,
        description: data.description,
        propertyType: data.propertyType,
        operation: data.operation,
        price: data.price,
        zone: data.zone,
        address: data.address,
        sourceUrl: data.sourceUrl,
        sourceNotes: data.sourceNotes,
        sourceId: data.sourceId,
        contactId: data.contactId,
        status: "REGISTERED",
        registeredById: user.id,
        assignedToId: user.id,
      },
    });
    await tx.stageHistory.create({
      data: {
        opportunityId: opp.id,
        fromStatus: null,
        toStatus: "REGISTERED",
        note: "Registro manual",
        userId: user.id,
      },
    });
    return opp;
  });

// Implementation notes:
// - Prisma `Decimal` (used for `price`) should be serialized carefully when
//   returning JSON (e.g. `price?.toString()`), avoid sending Prisma's Decimal
//   internals to the client.
// - For create actions consider returning the created resource id and setting
//   a `Location` header in HTTP responses (or return `{ id }` from server actions)
//   to make it easy for clients to redirect to the new resource.

  revalidatePath("/oportunidades");
  return { error: null, id: opportunity.id };
}

// ─── Cambiar estatus ──────────────────────────────────────

const changeStatusSchema = z.object({
  opportunityId: z.string(),
  toStatus: z.nativeEnum(OpportunityStatus),
  note: z.string().optional(),
});

export async function changeStatusAction(
  _prev: { error: string | null; done: boolean },
  formData: FormData,
): Promise<{ error: string | null; done: boolean }> {
  const user = await requireUser();
  const parsed = changeStatusSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    toStatus: formData.get("toStatus"),
    note: emptyToUndefined(formData.get("note")),
  });
  if (!parsed.success) return { error: "Datos inválidos", done: false };
  const { opportunityId, toStatus, note } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const current = await tx.opportunity.findUnique({ where: { id: opportunityId } });
    if (!current || current.status === toStatus) return;

    await tx.opportunity.update({
      where: { id: opportunityId },
      data: {
        status: toStatus,
        // KPI de contacto < 24h: se registra el momento del primer contacto
        ...(toStatus === "CONTACTED" && !current.firstContactAt
          ? { firstContactAt: new Date() }
          : {}),
      },
    });
    await tx.stageHistory.create({
      data: { opportunityId, fromStatus: current.status, toStatus, note, userId: user.id },
    });
  });

  revalidatePath(`/oportunidades/${opportunityId}`);
  revalidatePath("/oportunidades");
  return { error: null, done: true };
}

// ─── Calificar ────────────────────────────────────────────

const qualificationSchema = z.object({
  opportunityId: z.string(),
  qualification: z.nativeEnum(Qualification),
  qualificationNotes: z.string().optional(),
});

export async function setQualificationAction(
  _prev: { error: string | null; done: boolean },
  formData: FormData,
): Promise<{ error: string | null; done: boolean }> {
  const user = await requireUser();
  const parsed = qualificationSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    qualification: formData.get("qualification"),
    qualificationNotes: emptyToUndefined(formData.get("qualificationNotes")),
  });
  if (!parsed.success) return { error: "Datos inválidos", done: false };
  const { opportunityId, qualification, qualificationNotes } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const current = await tx.opportunity.findUnique({ where: { id: opportunityId } });
    if (!current) return;

    const autoAdvance = ["DETECTED", "REGISTERED", "VALIDATING"].includes(current.status);
    await tx.opportunity.update({
      where: { id: opportunityId },
      data: {
        qualification,
        qualificationNotes,
        ...(autoAdvance ? { status: "QUALIFIED" as const } : {}),
      },
    });
    if (autoAdvance) {
      await tx.stageHistory.create({
        data: {
          opportunityId,
          fromStatus: current.status,
          toStatus: "QUALIFIED",
          note: "Calificación asignada",
          userId: user.id,
        },
      });
    }
  });

  revalidatePath(`/oportunidades/${opportunityId}`);
  revalidatePath("/oportunidades");
  return { error: null, done: true };
}
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 3: Registro de oportunidades

### 3.1 Página

**File:** `centinela/src/app/(app)/oportunidades/nueva/page.tsx` (CREATE)
```tsx
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { NewOpportunityForm } from "./new-opportunity-form";

export default async function NewOpportunityPage() {
  await requireUser();
  const [sources, contacts] = await Promise.all([
    prisma.source.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nueva oportunidad</h1>
        <p className="text-sm text-muted-foreground">
          Registra una propiedad detectada. Entra al pipeline en estatus “Registrada”.
        </p>
      </div>
      <NewOpportunityForm sources={sources} contacts={contacts} />
    </div>
  );
}
```

### 3.2 Formulario (client)

**File:** `centinela/src/app/(app)/oportunidades/nueva/new-opportunity-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OPERATION_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/labels";
import { createOpportunityAction } from "../actions";

type Option = { id: string; name: string };

export function NewOpportunityForm({ sources, contacts }: { sources: Option[]; contacts: Option[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createOpportunityAction, {
    error: null as string | null,
    id: null as string | null,
  });

  useEffect(() => {
    if (state?.id) router.push(`/oportunidades/${state.id}`);
  }, [state?.id, router]);

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">Título *</Label>
        <Input id="title" name="title" required minLength={5}
          placeholder="Ej. Casa en San Mateo Oxtotitlán, 3 recámaras" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="propertyType">Tipo de inmueble *</Label>
        <select id="propertyType" name="propertyType" required
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="operation">Operación *</Label>
        <select id="operation" name="operation" required
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          {Object.entries(OPERATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">Precio (MXN)</Label>
        <Input id="price" name="price" type="number" min={1} step="1" placeholder="1500000" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="zone">Zona / colonia / municipio</Label>
        <Input id="zone" name="zone" placeholder="Ej. Toluca Centro" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" name="address" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="sourceUrl">Liga de la publicación</Label>
        <Input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://…" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sourceId">Fuente</Label>
        <select id="sourceId" name="sourceId"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm" defaultValue="">
          <option value="">Sin fuente</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactId">Contacto asociado</Label>
        <select id="contactId" name="contactId"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm" defaultValue="">
          <option value="">Sin contacto</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="sourceNotes">¿Cómo se detectó?</Label>
        <Textarea id="sourceNotes" name="sourceNotes"
          placeholder="Ej. operador site:facebook.com, alerta de Google, referencia de aliado…" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" name="description" />
      </div>

      {state?.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Registrando…" : "Registrar oportunidad"}
        </Button>
      </div>
    </form>
  );
}
```

Si el componente `Textarea` no está instalado, ejecuta `pnpm dlx shadcn@latest add textarea`.

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 4: Listado con filtros y paginación

### 4.1 Barra de filtros (client)

**File:** `centinela/src/app/(app)/oportunidades/filters.tsx` (CREATE)
```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OPERATION_LABELS, OPPORTUNITY_STATUS_LABELS, PROPERTY_TYPE_LABELS, QUALIFICATION_LABELS,
} from "@/lib/labels";

function pushParam(router: ReturnType<typeof useRouter>, searchParams: URLSearchParams,
  param: string, value: string) {
  const params = new URLSearchParams(searchParams.toString());
  if (value) params.set(param, value);
  else params.delete(param);
  params.delete("page");
  router.push(`/oportunidades?${params.toString()}`);
}

function FilterSelect({ label, param, value, options }: {
  label: string; param: string; value: string; options: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select value={value}
        onChange={(e) => pushParam(router, searchParams, param, e.target.value)}
        className="h-9 rounded-md border bg-background px-3 text-sm">
        <option value="">Todos</option>
        {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function OpportunitiesFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-6">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-2">
        Búsqueda
        <Input defaultValue={searchParams.get("q") ?? ""} placeholder="Título o zona… (Enter)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              pushParam(router, searchParams, "q", (e.target as HTMLInputElement).value);
            }
          }} />
      </label>
      <FilterSelect label="Estatus" param="status"
        value={searchParams.get("status") ?? ""} options={OPPORTUNITY_STATUS_LABELS} />
      <FilterSelect label="Tipo" param="propertyType"
        value={searchParams.get("propertyType") ?? ""} options={PROPERTY_TYPE_LABELS} />
      <FilterSelect label="Operación" param="operation"
        value={searchParams.get("operation") ?? ""} options={OPERATION_LABELS} />
      <div className="flex items-end">
        <Button variant="ghost" size="sm" onClick={() => router.push("/oportunidades")}>
          Limpiar
        </Button>
      </div>
    </div>
  );
}
```

### 4.2 Reemplazar la página placeholder del listado

**File:** `centinela/src/app/(app)/oportunidades/page.tsx` (REPLACE)

Server component. Estructura requerida (implementa el JSX completo siguiendo este esqueleto):

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { Prisma, OperationType, OpportunityStatus, PropertyType, Qualification } from "@prisma/client";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  OPERATION_LABELS, OPPORTUNITY_STATUS_LABELS, PROPERTY_TYPE_LABELS,
  QUALIFICATION_LABELS, STATUS_BADGE_VARIANT,
} from "@/lib/labels";
import { OpportunitiesFilters } from "./filters";

const PAGE_SIZE = 20;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const raw = await searchParams;

  // 1) Validar cada filtro contra su mapa de etiquetas (descartar valores inválidos)
  // 2) Construir `where: Prisma.OpportunityWhereInput` con:
  //    status, propertyType, operation, qualification exactos +
  //    q → OR contains insensitive sobre title y zone
  // 3) page (default 1), PAGE_SIZE = 20
  // 4) $transaction([findMany con include source/contact + orderBy createdAt desc
  //    + skip/take, count({ where })])
  // 5) JSX:
  //    - Header con título, conteo ("N oportunidades · página X de Y")
  //      y <Button asChild><Link href="/oportunidades/nueva">+ Nueva oportunidad</Link></Button>
  //    - <Suspense fallback={null}><OpportunitiesFilters /></Suspense>
  //    - Tabla: Título (Link al detalle), Tipo, Operación, Precio, Zona,
  //      Estatus (Badge con STATUS_BADGE_VARIANT), Calificación (o "—"),
  //      Fuente (source?.name o "—"), Registro (formatDateTime)
  //    - Estado vacío con mensaje y liga a /oportunidades/nueva
  //    - Paginación: botones Anterior / Siguiente que conservan los filtros
  //      (reconstruye el query string sin `page` y agrega la página destino)
}
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 5: Detalle, cambio de estatus y calificación

### 5.1 Formulario de cambio de estatus (client)

**File:** `centinela/src/app/(app)/oportunidades/[id]/change-status-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";
import { changeStatusAction } from "../actions";

export function ChangeStatusForm({ opportunityId, currentStatus }: {
  opportunityId: string;
  currentStatus: string;
}) {
  const [state, formAction, pending] = useActionState(changeStatusAction, {
    error: null as string | null,
    done: false,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <div className="space-y-2">
        <Label htmlFor="toStatus">Nuevo estatus</Label>
        <select id="toStatus" name="toStatus" required defaultValue=""
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="" disabled>Selecciona…</option>
          {Object.entries(OPPORTUNITY_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value} disabled={value === currentStatus}>{label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Input id="note" name="note" placeholder="Ej. validada con fotos y visita" />
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.done ? <p className="text-sm text-green-600">Estatus actualizado.</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Actualizando…" : "Actualizar estatus"}
      </Button>
    </form>
  );
}
```

### 5.2 Formulario de calificación (client)

**File:** `centinela/src/app/(app)/oportunidades/[id]/qualification-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QUALIFICATION_LABELS } from "@/lib/labels";
import { setQualificationAction } from "../actions";

export function QualificationForm({ opportunityId }: { opportunityId: string }) {
  const [state, formAction, pending] = useActionState(setQualificationAction, {
    error: null as string | null,
    done: false,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <div className="space-y-2">
        <Label htmlFor="qualification">Calificación</Label>
        <select id="qualification" name="qualification" required defaultValue=""
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="" disabled>Selecciona…</option>
          {Object.entries(QUALIFICATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Criterios: precio, motivación del propietario y documentación disponible.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="qualificationNotes">Notas de calificación</Label>
        <Textarea id="qualificationNotes" name="qualificationNotes" />
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.done ? <p className="text-sm text-green-600">Calificación guardada.</p> : null}
      <Button type="submit" disabled={pending} variant="secondary" className="w-full">
        {pending ? "Guardando…" : "Guardar calificación"}
      </Button>
    </form>
  );
}
```

### 5.3 Página de detalle

**File:** `centinela/src/app/(app)/oportunidades/[id]/page.tsx` (CREATE)

Server component. Requisitos:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
// ... imports de guards, prisma, ui (Badge, Button, Card*), format, labels, formularios

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      source: true,
      contact: true,
      registeredBy: true,
      assignedTo: true,
      stageHistory: { orderBy: { createdAt: "desc" }, include: { user: true } },
      priceEvents: { orderBy: { detectedAt: "desc" } },
    },
  });
  if (!opportunity) notFound();

  // SLA: si hay firstContactAt → horas entre registro y contacto (✅ si ≤ 24, ⚠️ si > 24)
  // Si NO hay firstContactAt y pasaron > 24h desde createdAt → alerta "Sin contactar en 24h"

  // JSX (grid de 3 columnas en lg, contenido ocupa 2):
  // - Header: título + Badge de estatus + Badge de calificación (si existe)
  //   + botón "← Volver al listado"
  // - Card "Datos del inmueble": tipo, operación, precio (formatMoney), zona,
  //   dirección, fuente (source.name), liga de publicación (<a target="_blank">),
  //   cómo se detectó (sourceNotes), descripción, contacto (contact.name + teléfono),
  //   registrado por (registeredBy.name), fecha de registro (formatDateTime)
  // - Card "Contacto (SLA)": estado del SLA calculado arriba
  // - Card "Cambios de precio": lista de priceEvents (oldPrice → newPrice, fecha)
  //   o texto "Sin cambios de precio registrados."
  // - Columna derecha: Card "Cambiar estatus" con <ChangeStatusForm .../>,
  //   Card "Calificación" con <QualificationForm .../>,
  //   Card "Historial de etapas": lista del stageHistory
  //   (toStatus label ← fromStatus label, usuario, fecha, nota)
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
git add -A && git commit -m "feat: opportunities CRUD and pipeline (task 004)"
```

RUN (verificación de runtime):
```bash
docker compose up -d
pnpm dev &
sleep 8
curl -sI http://localhost:3000/oportunidades | head -5   # 3xx hacia /login sin sesión
```

Si tienes navegador disponible, verifica el flujo completo con sesión iniciada:
registrar una oportunidad → aparece en el listado → cambiar estatus → queda en el
historial → calificar → avanza a "Calificada".

Anota en el resumen final cualquier verificación manual que no pudiste ejecutar.

---

## Checklist

### Phase 1
- [x] `src/lib/labels.ts` y `src/lib/format.ts` creados
- [x] `pnpm typecheck` pasa

### Phase 2
- [x] `actions.ts` con create / changeStatus / setQualification
- [x] Transacciones escriben `StageHistory`
- [x] `firstContactAt` se fija al pasar a CONTACTED
- [x] `pnpm typecheck` pasa

### Phase 3
- [x] `/oportunidades/nueva` con formulario validado
- [x] Al crear, redirige al detalle

### Phase 4
- [x] Listado con 5 filtros + paginación de 20
- [x] Filtros envueltos en `<Suspense>`
- [x] `pnpm build` pasa

### Phase 5
- [x] Detalle con datos completos, SLA, historial y cambios de precio
- [x] Cambio de estatus y calificación funcionan vía server actions

### Phase 6
- [x] `pnpm typecheck && pnpm lint && pnpm build` ✅
- [x] Commit `feat: opportunities CRUD and pipeline (task 004)`
- [x] Redirect sin sesión verificado

---

## Do NOT Do

- Do NOT tocar `prisma/schema.prisma` ni generar migraciones
- Do NOT construir CRUD de contactos ni agenda de citas (tarea 005)
- Do NOT calcular métricas ni construir el dashboard (tarea 006)
- Do NOT importar CSV ni conectores de ingestión (tarea 007)
- Do NOT implementar edición ni borrado físico de oportunidades
- Do NOT subir imágenes ni archivos de las propiedades
- Do NOT modificar auth, middleware, AppShell ni layouts
- Do NOT agregar paginación infinita, tablas virtuales ni librerías extra de UI
