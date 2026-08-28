# Task 006: Dashboard de KPIs y entregables diarios

## LLM Agent Directives

You are building the **KPI dashboard and daily reports** of Centinela to achieve
the measurement layer of the prospecting machine: every target from the business
brief becomes a visible, real-time number, and each day closes with a saved
deliverable snapshot.

Lee primero `.tasks/CONTEXT.md` (sección 3: los 5 KPIs). El proyecto existe en
`centinela/` con las tareas 001–005 completas. Trabaja desde `centinela/`.
Sigue los patrones establecidos (server components + `requireUser()`, acciones
con Zod, `revalidatePath`).

**Goals:**
1. Convertir la página inicial en un dashboard con los 5 KPIs del brief,
   semáforo contra meta y barras de progreso
2. Embudo de captación: conteo de oportunidades por estatus
3. Inteligencia comercial básica: zonas activas (30 días) y fuentes más productivas
4. Página `/reportes`: entregables del día por fecha (calculados en servidor),
   guardado del snapshot en `DailyReport` e historial
5. Quality gates verdes al final

**Rules:**
- DO NOT modificar `prisma/schema.prisma` ni crear migraciones
- DO NOT agregar librerías de gráficas (recharts, chart.js…) — barras con Tailwind
- DO NOT programar jobs/cron ni guardar snapshots automáticamente
- DO NOT exportar CSV ni enviar reportes por correo (tarea 007 y posteriores)
- DO NOT tocar los módulos de tareas previas (oportunidades, contactos, citas, auth)
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio

---

## Phase 1: Utilidad de fecha local

**File:** `centinela/src/lib/format.ts` (MODIFY)

APPEND al final del archivo:
```typescript
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 2: Dashboard en la página inicial

**File:** `centinela/src/app/(app)/page.tsx` (REPLACE)

Server component completo. Requisitos de datos (todo en un `Promise.all`):

```tsx
import Link from "next/link";
import { OpportunityStatus } from "@prisma/client";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";

const DAY_MS = 24 * 3600 * 1000;

// NOTE: Be explicit about timezone handling. Date range comparisons should use
// UTC or a consistent server timezone; normalize date inputs to avoid
// off-by-one-day errors when computing daily/weekly counts.

// Componente local KpiCard (en este mismo archivo, arriba del default export):
function KpiCard({ title, value, targetLabel, ratio, hint }: {
  title: string;
  value: string;
  targetLabel: string;
  ratio: number | null;   // 1.0 = meta cumplida
  hint?: string;
}) {
  const level = ratio == null ? "none" : ratio >= 1 ? "ok" : ratio >= 0.6 ? "warn" : "bad";
  const barColor =
    level === "ok" ? "bg-green-500" : level === "warn" ? "bg-amber-500"
    : level === "bad" ? "bg-red-500" : "bg-muted";
  const pct = ratio == null ? 0 : Math.min(100, Math.round(ratio * 100));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-semibold">{value}</div>
        <div className="h-2 rounded-full bg-muted">
          <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {targetLabel}{hint ? ` · ${hint}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
```

Consultas (todas dentro del server component):

```tsx
const user = await requireUser();

const now = new Date();
const startOfToday = new Date(now);
startOfToday.setHours(0, 0, 0, 0);
const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
const monthAgo = new Date(now.getTime() - 30 * DAY_MS);

const [
  propertiesToday,      // opportunity.count createdAt >= inicio de hoy
  contactsWeek,         // contact.count createdAt >= hace 7 días
  totalActive,          // opportunity.count status != DISCARDED
  qualifiedCount,       // opportunity.count status != DISCARDED y qualification != null
  appointmentsWeek,     // appointment.count scheduledAt >= hace 7 días
  contactedRows,        // opportunity.findMany firstContactAt != null
                        //   (select createdAt, firstContactAt)
  byStatus,             // opportunity.groupBy by status, _count
  zones,                // opportunity.groupBy by zone (zone != null, últimos 30 días),
                        //   ordenado por _count desc, take 8
  topSources,           // opportunity.groupBy by sourceId (sourceId != null),
                        //   ordenado por _count desc, take 5
] = await Promise.all([ /* … */ ]);

// Después: nombres de las fuentes top
// (source.findMany where id in topSources.sourceId → Map<id, name>)
```

Cálculos derivados:
```tsx
const inTime = contactedRows.filter(
  (o) => o.firstContactAt!.getTime() - o.createdAt.getTime() <= DAY_MS,
).length;
const qualificationRate = totalActive > 0 ? Math.round((qualifiedCount / totalActive) * 100) : 0;
const slaRate = contactedRows.length > 0 ? Math.round((inTime / contactedRows.length) * 100) : null;
```

JSX requerido:
```tsx
// 1) Header: "Hola, {primer nombre} 👋" + "Así va la prospección hoy."
//    Botones: "+ Oportunidad" (→ /oportunidades/nueva) y
//    "Entregables del día" (→ /reportes, variant outline)
//
// 2) Grid de KPIs (sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5):
//    - "Propiedades captadas hoy"      → value propertiesToday, meta "20+ por día",      ratio /20
//    - "Contactos nuevos (7 días)"     → value contactsWeek,  meta "50+ por semana",     ratio /50
//    - "Oportunidades calificadas"     → value `${qualificationRate}%`, meta "30% o más",
//        hint "X de Y", ratio qualificationRate/30
//    - "Citas (7 días)"                → value appointmentsWeek, meta "10+ por semana",  ratio /10
//    - "Contacto en menos de 24h"      → value slaRate ?? "—", meta "100%",
//        hint: si slaRate == null "Aún sin primeros contactos"
//        si no "X de Y a tiempo", ratio slaRate/100 (o null)
//
// 3) Grid lg:grid-cols-3:
//    - Card "Embudo de captación" (col-span-2): una fila por estatus en el orden
//      DETECTED → … → DISCARDED usando OPPORTUNITY_STATUS_LABELS:
//      etiqueta (w-28) + barra proporcional al máximo + conteo.
//    - Columna derecha: Card "Zonas activas (30 días)" con top 8 (zona + conteo,
//      vacío → "Sin datos todavía.") y Card "Fuentes más productivas" con top 5
//      (nombre de la fuente o "Fuente eliminada" + conteo, vacío idem).
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 3: Acción de guardado del entregable diario

**File:** `centinela/src/app/(app)/reportes/actions.ts` (CREATE)
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 3600 * 1000;

export async function saveDailyReportAction(
  _prev: { error: string | null; done: boolean },
  formData: FormData,
): Promise<{ error: string | null; done: boolean }> {
  const user = await requireUser();

  const dateStr = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "Fecha inválida", done: false };
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { error: "Fecha inválida", done: false };
  const end = new Date(date.getTime() + DAY_MS);

  const notesRaw = formData.get("notes");
  const notes = typeof notesRaw === "string" && notesRaw.trim() !== "" ? notesRaw.trim() : null;

  // Los contadores SIEMPRE se recalculan en el servidor
  const [propertiesDetected, newContacts, priceChanges, appointmentsScheduled, inventoryCount] =
    await prisma.$transaction([
      prisma.opportunity.count({ where: { createdAt: { gte: date, lt: end } } }),
      prisma.contact.count({ where: { createdAt: { gte: date, lt: end } } }),
      prisma.priceEvent.count({ where: { detectedAt: { gte: date, lt: end } } }),
      prisma.appointment.count({ where: { scheduledAt: { gte: date, lt: end } } }),
      prisma.opportunity.count({ where: { status: "INVENTORY" } }),
    ]);

  const data = {
    propertiesDetected,
    newContacts,
    priceChanges,
    appointmentsScheduled,
    inventoryUpdated: inventoryCount > 0,
    notes,
  };

  await prisma.dailyReport.upsert({
    where: { date },
    update: data,
    create: { date, ...data, createdById: user.id },
  });

  revalidatePath("/reportes");
  return { error: null, done: true };
}
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 4: Página de reportes

### 4.1 Navegador de fecha (client)

**File:** `centinela/src/app/(app)/reportes/date-nav.tsx` (CREATE)
```tsx
"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export function ReportDateNav({ date }: { date: string }) {
  const router = useRouter();
  return (
    <Input
      type="date"
      value={date}
      onChange={(e) => {
        if (e.target.value) router.push(`/reportes?date=${e.target.value}`);
      }}
      className="w-auto"
    />
  );
}
```

### 4.2 Formulario de guardado (client)

**File:** `centinela/src/app/(app)/reportes/save-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveDailyReportAction } from "./actions";

export function SaveReportForm({ date, initialNotes }: { date: string; initialNotes: string }) {
  const [state, formAction, pending] = useActionState(saveDailyReportAction, {
    error: null as string | null,
    done: false,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="date" value={date} />
      <Textarea
        name="notes"
        defaultValue={initialNotes}
        placeholder="Notas del día (opcional): hallazgos, alertas, pendientes…"
      />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.done ? <p className="text-sm text-green-600">Entregable guardado.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar entregable del día"}
      </Button>
    </form>
  );
}
```

### 4.3 Reemplazar la página placeholder

**File:** `centinela/src/app/(app)/reportes/page.tsx` (REPLACE)

Server component. Requisitos:

```tsx
// searchParams: date (YYYY-MM-DD validada con regex; default = hoy con toLocalISODate)
// date = new Date(`${dateStr}T00:00:00`); end = date + 1 día
// Datos (Promise.all):
//   - $transaction con los 5 contadores del día (mismas queries que la acción):
//     propiedades detectadas, contactos nuevos, cambios de precio,
//     citas programadas ese día, inventario actual (status INVENTORY)
//   - dailyReport.findUnique({ where: { date } })  → snapshot existente (o null)
//   - dailyReport.findMany({ orderBy: { date: "desc" }, take: 30,
//     include: { createdBy: true } })  → historial
// JSX:
// - Header "Reportes diarios" + navegación:
//   Link "← Anterior" (?date=día previo), <ReportDateNav date={dateStr} />,
//   Link "Siguiente →" (día siguiente)
// - Card "Entregables del {fecha}": grid con 5 bloques de dato calculado:
//   Propiedades detectadas / Contactos nuevos / Cambios de precio /
//   Citas programadas / Inventario actual (Badge "Sí"/"No" según inventoryCount > 0)
// - Card "Cerrar entregable": <SaveReportForm date={dateStr}
//   initialNotes={existing?.notes ?? ""} />
//   + si existe snapshot: texto "Último guardado: {formatDateTime(existing.createdAt)}"
// - Card "Historial": tabla de snapshots guardados:
//   Fecha (toLocalISODate), Propiedades, Contactos, Cambios de precio, Citas,
//   Inventario (✓ / —), Notas (truncadas), Guardado por (createdBy?.name)
//   Vacío → "Aún no hay entregables guardados."
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 5: Gates, commit y verify final

RUN:
```bash
pnpm typecheck
pnpm lint
pnpm build
git add -A && git commit -m "feat: KPI dashboard and daily reports (task 006)"
```

RUN (verificación de runtime):
```bash
docker compose up -d
pnpm dev &
sleep 8
curl -sI http://localhost:3000/ | head -5          # 3xx hacia /login sin sesión
curl -sI http://localhost:3000/reportes | head -5  # 3xx hacia /login sin sesión
```

Si tienes navegador disponible, verifica con sesión:
- El dashboard muestra los 5 KPIs con barras y semáforos
- `/reportes` calcula los entregables del día y permite cambiar de fecha
- "Guardar entregable del día" crea el snapshot y aparece en el historial

Anota en el resumen final cualquier verificación manual que no pudiste ejecutar.

---

## Checklist

### Phase 1
- [ ] `toLocalISODate` agregado a `format.ts`

### Phase 2
- [ ] Home reemplazado por dashboard
- [ ] 5 KPIs con semáforo contra meta
- [ ] Embudo por estatus + zonas activas + fuentes top
- [ ] `pnpm build` pasa

### Phase 3
- [ ] `saveDailyReportAction` recalcula contadores en servidor
- [ ] Upsert por fecha respeta la unicidad de `DailyReport.date`

### Phase 4
- [ ] `/reportes` con navegación por fecha
- [ ] Guardado de entregable + historial de 30 días

### Phase 5
- [ ] `pnpm typecheck && pnpm lint && pnpm build` ✅
- [ ] Commit `feat: KPI dashboard and daily reports (task 006)`

---

## Do NOT Do

- Do NOT tocar `prisma/schema.prisma` ni generar migraciones
- Do NOT instalar librerías de gráficas
- Do NOT programar cron jobs ni snapshots automáticos
- Do NOT exportar CSV ni enviar reportes por correo/WhatsApp
- Do NOT modificar los módulos de oportunidades, contactos, citas, usuarios ni auth
- Do NOT cambiar las fórmulas de KPI definidas en este spec
- Do NOT construir comparativas históricas de tendencias (candidato a tarea futura)
