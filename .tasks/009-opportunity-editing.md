# Task 009: Edición de oportunidades

## LLM Agent Directives

You are adding **opportunity editing** to Centinela to achieve correctable
registrations: detections imported from RSS (task 007) arrive with placeholder
type/operation and must be fixable during validation, and any data error must be
correctable without re-registering.

Lee primero `.tasks/CONTEXT.md` y el spec de la tarea 004 (módulo de oportunidades).
El proyecto existe en `centinela/` con las tareas 001–008 completas. Trabaja desde
`centinela/`. Sigue el patrón de formularios reutilizables de las tareas 005/008
(`ContactForm`, `AllianceForm`).

**Goals:**
1. `updateOpportunityAction` validada con Zod sobre los mismos campos que la creación
2. Refactor del formulario de la tarea 004 a `OpportunityForm` reutilizable (crear/editar)
3. Página `/oportunidades/[id]/editar` con datos precargados
4. Botón "Editar" en la página de detalle
5. El flujo de creación existente sigue funcionando idéntico
6. Quality gates verdes al final

**Rules:**
- DO NOT modificar `prisma/schema.prisma` ni crear migraciones
- DO NOT cambiar el estatus ni la calificación desde la edición (hay formularios propios para eso)
- DO NOT escribir en `StageHistory` ni `PriceEvent` desde esta tarea
- DO NOT duplicar el formulario en un segundo componente — se refactoriza el existente
- DO NOT tocar listados, filtros, dashboard ni otros módulos
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio

---

## Phase 1: Acción de actualización

**File:** `centinela/src/app/(app)/oportunidades/actions.ts` (APPEND)

El archivo ya contiene `emptyToUndefined` y los schemas de la tarea 004; reutilízalos.

```typescript
// ─── Actualizar oportunidad ───────────────────────────────

const updateSchema = z.object({
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

export async function updateOpportunityAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData,
): Promise<{ error: string | null; id: string | null }> {
  await requireUser();
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!opportunityId) return { error: "Oportunidad inválida", id: null };

  const raw = Object.fromEntries(formData);
  const parsed = updateSchema.safeParse({
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

  const existing = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
  if (!existing) return { error: "La oportunidad ya no existe.", id: null };

  await prisma.opportunity.update({ where: { id: opportunityId }, data: parsed.data });

  revalidatePath(`/oportunidades/${opportunityId}`);
  revalidatePath("/oportunidades");
  revalidatePath("/");
  return { error: null, id: opportunityId };
}
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 2: Refactor a formulario reutilizable

### 2.1 Crear el formulario unificado

**File:** `centinela/src/app/(app)/oportunidades/opportunity-form.tsx` (CREATE)

Es el formulario de la tarea 004 (`nueva/new-opportunity-form.tsx`) con estos cambios:
export nombrado `OpportunityForm`, props opcionales `opportunityId`/`initial`,
acción condicional y `defaultValue` en todos los campos.

Nota: recuerda la regla del proyecto — **NO** crear migraciones ni tocar `prisma/schema.prisma` durante este refactor. Además, al refactorizar a `OpportunityForm` conserva las etiquetas `htmlFor` / `id` y otros atributos de accesibilidad para que los lectores de pantalla y la navegación por teclado sigan funcionando correctamente.

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OPERATION_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/labels";
import { createOpportunityAction, updateOpportunityAction } from "./actions";

type Option = { id: string; name: string };

export type OpportunityInitial = {
  title: string; description: string; propertyType: string; operation: string;
  price: string; zone: string; address: string; sourceUrl: string;
  sourceId: string; contactId: string; sourceNotes: string;
};

export function OpportunityForm({ sources, contacts, opportunityId, initial }: {
  sources: Option[];
  contacts: Option[];
  opportunityId?: string;
  initial?: OpportunityInitial;
}) {
  const router = useRouter();
  const action = opportunityId ? updateOpportunityAction : createOpportunityAction;
  const [state, formAction, pending] = useActionState(action, {
    error: null as string | null,
    id: null as string | null,
  });

  useEffect(() => {
    if (state?.id && !opportunityId) router.push(`/oportunidades/${state.id}`);
  }, [state?.id, opportunityId, router]);

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      {opportunityId ? <input type="hidden" name="opportunityId" value={opportunityId} /> : null}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">Título *</Label>
        <Input id="title" name="title" required minLength={5}
          defaultValue={initial?.title}
          placeholder="Ej. Casa en San Mateo Oxtotitlán, 3 recámaras" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="propertyType">Tipo de inmueble *</Label>
        <select id="propertyType" name="propertyType" required
          defaultValue={initial?.propertyType ?? "HOUSE"}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="operation">Operación *</Label>
        <select id="operation" name="operation" required
          defaultValue={initial?.operation ?? "SALE"}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          {Object.entries(OPERATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">Precio (MXN)</Label>
        <Input id="price" name="price" type="number" min={1} step="1"
          defaultValue={initial?.price} placeholder="1500000" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="zone">Zona / colonia / municipio</Label>
        <Input id="zone" name="zone" defaultValue={initial?.zone} placeholder="Ej. Toluca Centro" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" name="address" defaultValue={initial?.address} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="sourceUrl">Liga de la publicación</Label>
        <Input id="sourceUrl" name="sourceUrl" type="url" defaultValue={initial?.sourceUrl}
          placeholder="https://…" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sourceId">Fuente</Label>
        <select id="sourceId" name="sourceId" defaultValue={initial?.sourceId ?? ""}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Sin fuente</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactId">Contacto asociado</Label>
        <select id="contactId" name="contactId" defaultValue={initial?.contactId ?? ""}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Sin contacto</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="sourceNotes">¿Cómo se detectó?</Label>
        <Textarea id="sourceNotes" name="sourceNotes" defaultValue={initial?.sourceNotes}
          placeholder="Ej. operador site:facebook.com, alerta de Google, referencia de aliado…" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" name="description" defaultValue={initial?.description} />
      </div>

      {state?.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
      {opportunityId && !state?.error && state?.id ? (
        <p className="text-sm text-green-600 sm:col-span-2">Oportunidad actualizada.</p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Guardando…" : opportunityId ? "Guardar cambios" : "Registrar oportunidad"}
        </Button>
      </div>
    </form>
  );
}
```

### 2.2 Actualizar la página de creación

**File:** `centinela/src/app/(app)/oportunidades/nueva/page.tsx` (MODIFY)

FIND:
```tsx
import { NewOpportunityForm } from "./new-opportunity-form";
```
CHANGE TO:
```tsx
import { OpportunityForm } from "../opportunity-form";
```

FIND:
```tsx
<NewOpportunityForm sources={sources} contacts={contacts} />
```
CHANGE TO:
```tsx
<OpportunityForm sources={sources} contacts={contacts} />
```

### 2.3 Eliminar el formulario viejo

RUN:
```bash
git rm "src/app/(app)/oportunidades/nueva/new-opportunity-form.tsx"
```

VERIFY: `pnpm typecheck && pnpm build` pasan; el flujo de creación queda igual.

---

## Phase 3: Página de edición

**File:** `centinela/src/app/(app)/oportunidades/[id]/editar/page.tsx` (CREATE)
```tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { OpportunityForm, type OpportunityInitial } from "../../opportunity-form";

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const opportunity = await prisma.opportunity.findUnique({ where: { id } });
  if (!opportunity) notFound();

  const [sources, contacts] = await Promise.all([
    prisma.source.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const initial: OpportunityInitial = {
    title: opportunity.title,
    description: opportunity.description ?? "",
    propertyType: opportunity.propertyType,
    operation: opportunity.operation,
    price: opportunity.price ? opportunity.price.toString() : "",
    zone: opportunity.zone ?? "",
    address: opportunity.address ?? "",
    sourceUrl: opportunity.sourceUrl ?? "",
    sourceId: opportunity.sourceId ?? "",
    contactId: opportunity.contactId ?? "",
    sourceNotes: opportunity.sourceNotes ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar oportunidad</h1>
        <p className="text-sm text-muted-foreground">{opportunity.title}</p>
      </div>
      <OpportunityForm sources={sources} contacts={contacts} opportunityId={id} initial={initial} />
    </div>
  );
}
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 4: Botón "Editar" en el detalle

**File:** `centinela/src/app/(app)/oportunidades/[id]/page.tsx` (MODIFY)

Localiza el header de la página de detalle (donde está el botón
"← Volver al listado" de la tarea 004) y agrega a su lado:

```tsx
<Button asChild variant="outline">
  <Link href={`/oportunidades/${opportunity.id}/editar`}>Editar</Link>
</Button>
```

Conserva todo lo demás sin cambios.

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 5: Gates, commit y verify final

RUN:
```bash
pnpm typecheck
pnpm lint
pnpm build
git add -A && git commit -m "feat: opportunity editing (task 009)"
```

RUN (verificación de runtime):
```bash
docker compose up -d
pnpm dev &
sleep 8
curl -sI http://localhost:3000/oportunidades | head -5   # 3xx hacia /login sin sesión
```

Si tienes navegador disponible, verifica con sesión:
- Crear una oportunidad nueva (el refactor no rompió el flujo) y que redirija al detalle
- En el detalle: botón "Editar" → formulario precargado con los datos correctos
- Corregir tipo/operación/precio de una detección importada → guardar →
  el detalle refleja los cambios y el estatus NO cambió
- Editar con título menor a 5 caracteres → muestra el error de validación

Anota en el resumen final cualquier verificación manual que no pudiste ejecutar.

---

## Checklist

### Phase 1
- [ ] `updateOpportunityAction` agregada sin duplicar utilidades

### Phase 2
- [ ] `OpportunityForm` reutilizable creado
- [ ] Página de creación actualizada y funcionando igual
- [ ] `new-opportunity-form.tsx` eliminado
- [ ] `pnpm build` pasa

### Phase 3
- [ ] `/oportunidades/[id]/editar` precarga todos los campos
- [ ] Decimal de precio se serializa como string

### Phase 4
- [ ] Botón "Editar" visible en el detalle

### Phase 5
- [ ] `pnpm typecheck && pnpm lint && pnpm build` ✅
- [ ] Commit `feat: opportunity editing (task 009)`

---

## Do NOT Do

- Do NOT tocar `prisma/schema.prisma` ni generar migraciones
- Do NOT cambiar el estatus ni la calificación desde la edición
- Do NOT registrar entradas de `StageHistory` al editar
- Do NOT permitir editar citas, contactos, fuentes ni usuarios desde esta tarea
- Do NOT alterar los filtros del listado ni el dashboard
- Do NOT crear un segundo formulario duplicado en vez de refactorizar
- Do NOT mover ni renombrar rutas existentes
