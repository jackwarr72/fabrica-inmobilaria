# Task 012: Seguimiento y tendencias de precios

## LLM Agent Directives

You are building the **price intelligence layer** of Centinela to achieve the
commercial-intelligence goal from the brief ("transformar datos en
conocimiento"): price changes get recorded from the opportunity detail, and
a dedicated page surfaces trends — zones with the most movement and recent
price drops, which signal motivated owners and top-priority opportunities.

Lee primero `.tasks/CONTEXT.md` y el spec de la tarea 004 (detalle de
oportunidad; el modelo `PriceEvent` ya existe desde la tarea 002 y ya se
muestra en el detalle). El proyecto existe en `centinela/` con las tareas
001–011 completas. Trabaja desde `centinela/`.

**Goals:**

1. `logPriceChangeAction`: registra el evento en `PriceEvent` y actualiza el
   precio de la oportunidad en una sola transacción
2. Formulario "Registrar cambio de precio" montado en la card existente del
   detalle
3. Página `/precios` (últimos 30 días): cambios registrados, bajadas,
   subidas, variación promedio, zonas con más movimiento y lista de bajas
   recientes
4. Enlace "Precios" en la navegación
5. Quality gates verdes al final

**Rules:**

- DO NOT modificar `prisma/schema.prisma` ni crear migraciones
- DO NOT instalar librerías de gráficas — tablas y badges
- DO NOT permitir editar ni eliminar eventos de precio históricos
- DO NOT detectar precios automáticamente (eso viene de la ingestión/
  validación humana)

---

## Phase 1: Acción de cambio de precio

**File:** `centinela/src/app/(app)/oportunidades/actions.ts` (APPEND)

El archivo ya contiene `emptyToUndefined`; reutilízalo.

```typescript
// ─── Cambio de precio ─────────────────────────────────────

const priceChangeSchema = z.object({
  opportunityId: z.string(),
  newPrice: z.coerce.number().positive("El precio debe ser mayor a cero"),
  note: z.string().optional(),
});

export async function logPriceChangeAction(
  _prev: { error: string | null; done: boolean },
  formData: FormData,
): Promise<{ error: string | null; done: boolean }> {
  await requireUser();

  const parsed = priceChangeSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    newPrice: formData.get("newPrice"),
    note: emptyToUndefined(formData.get("note")),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
      done: false,
    };
  }
  const { opportunityId, newPrice, note } = parsed.data;

  const current = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
  });
  if (!current) {
    return { error: "La oportunidad ya no existe.", done: false };
  }

  const oldPrice = current.price != null ? Number(current.price) : null;
  if (oldPrice != null && Math.abs(oldPrice - newPrice) < 0.01) {
    return { error: "El nuevo precio es igual al actual.", done: false };
  }

  await prisma.$transaction(async (tx) => {
    await tx.priceEvent.create({
      data: {
        opportunityId,
        oldPrice: oldPrice ?? undefined,
        newPrice,
        note,
      },
    });
    await tx.opportunity.update({
      where: { id: opportunityId },
      data: { price: newPrice },
    });
  });

  revalidatePath(`/oportunidades/${opportunityId}`);
  revalidatePath("/oportunidades");
  revalidatePath("/precios");
  revalidatePath("/");
  return { error: null, done: true };
}
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 2: Formulario en el detalle

### 2.1 Componente (client)

**File:** `centinela/src/app/(app)/oportunidades/[id]/price-form.tsx` (CREATE)

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logPriceChangeAction } from "../actions";

export function PriceChangeForm({
  opportunityId,
  currentPrice,
}: {
  opportunityId: string;
  currentPrice: string; // ya formateado, p. ej. "$2,500,000" o "—"
}) {
  const [state, formAction, pending] = useActionState(logPriceChangeAction, {
    error: null as string | null,
    done: false,
  });

  return (
    <form action={formAction} className="space-y-3 rounded-md border p-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <div className="space-y-2">
        <Label htmlFor="newPrice">
          Nuevo precio (MXN) — actual: {currentPrice}
        </Label>
        <Input
          id="newPrice"
          name="newPrice"
          type="number"
          min={1}
          step="1"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="priceNote">Nota (opcional)</Label>
        <Input
          id="priceNote"
          name="note"
          placeholder="Ej. el propietario urge vender"
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.done ? (
        <p className="text-sm text-green-600">
          Cambio de precio registrado.
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        size="sm"
        variant="secondary"
        className="w-full"
      >
        {pending ? "Registrando…" : "Registrar cambio de precio"}
      </Button>
    </form>
  );
}
```

### 2.2 Montarlo en la card de cambios de precio

**File:** `centinela/src/app/(app)/oportunidades/[id]/page.tsx` (MODIFY)

Localiza la Card "Cambios de precio" (tarea 004). Al inicio de su contenido,
ANTES de la lista de eventos, inserta:

```tsx
<PriceChangeForm
  opportunityId={opportunity.id}
  currentPrice={formatMoney(opportunity.price)}
/>
```

y agrega el import del componente. Conserva la lista existente debajo.

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 3: Página de tendencias

### 3.1 Página `/precios`

**File:** `centinela/src/app/(app)/precios/page.tsx`
(REPLACE del placeholder de la tarea 001)

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/format";

const DAY_MS = 24 * 3600 * 1000;

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default async function PricesPage() {
  await requireUser();

  const now = Date.now();
  const monthAgo = new Date(now - 30 * DAY_MS);

  const events = await prisma.priceEvent.findMany({
    where: { detectedAt: { gte: monthAgo } },
    include: {
      opportunity: { select: { id: true, title: true, zone: true } },
    },
    orderBy: { detectedAt: "desc" },
    take: 500,
  });

  let downs = 0;
  let ups = 0;
  const variations: number[] = [];
  const zoneAgg = new Map<string, { count: number; sumPct: number }>();
  const drops: {
    id: string;
    title: string;
    zone: string | null;
    oldPrice: number;
    newPrice: number;
    pct: number;
    daysAgo: number;
  }[] = [];

  for (const e of events) {
    const oldP = e.oldPrice != null ? Number(e.oldPrice) : null;
    const newP = Number(e.newPrice);
    if (oldP == null || oldP <= 0) continue; // sin precio base no hay variación

    const pct = ((newP - oldP) / oldP) * 100;
    variations.push(pct);
    if (pct < 0) downs += 1;
    else if (pct > 0) ups += 1;

    const zone = e.opportunity.zone?.trim() || "Sin zona";
    const agg = zoneAgg.get(zone) ?? { count: 0, sumPct: 0 };
    agg.count += 1;
    agg.sumPct += pct;
    zoneAgg.set(zone, agg);

    if (pct < 0) {
      drops.push({
        id: e.opportunity.id,
        title: e.opportunity.title,
        zone: e.opportunity.zone,
        oldPrice: oldP,
        newPrice: newP,
        pct,
        daysAgo: Math.max(
          0,
          Math.round((now - e.detectedAt.getTime()) / DAY_MS),
        ),
      });
    }
  }

  const avgPct =
    variations.length > 0
      ? variations.reduce((a, b) => a + b, 0) / variations.length
      : null;

  const zones = [...zoneAgg.entries()]
    .map(([zone, { count, sumPct }]) => ({
      zone,
      count,
      avgPct: sumPct / count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  drops.sort((a, b) => a.pct - b.pct);
  const topDrops = drops.slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tendencias de precios</h1>
        <p className="text-sm text-muted-foreground">
          Inteligencia comercial de los últimos 30 días. Las bajas de precio
          señalan propietarios motivados: prioridad de contacto.
        </p>
      </div>

      {/* Bloques de resumen: Cambios registrados (events.length), Bajadas
          (downs), Subidas (ups), Variación promedio (formatPct(avgPct) o
          "—"). Usa 4 Cards pequeñas en grid sm:grid-cols-2 lg:grid-cols-4. */}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Zonas con más movimiento</CardTitle>
            <CardDescription>
              Cambios de precio y variación promedio por zona
            </CardDescription>
          </CardHeader>
          <CardContent>
            {zones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {zones.map((z) => (
                  <li
                    key={z.zone}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>{z.zone}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground">
                        {z.count} cambio{z.count === 1 ? "" : "s"}
                      </span>
                      <span
                        className={
                          z.avgPct < 0
                            ? "text-red-600"
                            : z.avgPct > 0
                              ? "text-green-600"
                              : ""
                        }
                      >
                        {formatPct(z.avgPct)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bajas recientes — propietarios motivados</CardTitle>
            <CardDescription>
              Ordenadas por % de caída; atácalas primero
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topDrops.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin bajas de precio en 30 días.
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {topDrops.map((d) => (
                  <li key={`${d.id}-${d.pct}`} className="space-y-1">
                    <Link
                      href={`/oportunidades/${d.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {d.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {d.zone ?? "Sin zona"} · hace {d.daysAgo} día
                        {d.daysAgo === 1 ? "" : "s"}
                      </span>
                      <span className="tabular-nums">
                        {formatMoney(d.oldPrice)} → {formatMoney(d.newPrice)}
                      </span>
                      <Badge variant="destructive">{formatPct(d.pct)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

Implementa el bloque de resumen comentado con 4 Cards (mismo estilo que los
bloques de dato de la tarea 006).

### 3.2 Enlace en la navegación

**File:** `centinela/src/components/app-shell.tsx` (MODIFY)

Agrega `{ href: "/precios", label: "Precios" }` al arreglo de navegación,
después de "Reportes", conservando todo lo existente.

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 4: Gates, commit y verify final

RUN:

```bash
pnpm typecheck
pnpm lint
pnpm build
git add -A && git commit -m "feat: price tracking and trends (task 012)"
```

RUN (verificación de runtime):

```bash
docker compose up -d
pnpm dev &
sleep 8
curl -sI http://localhost:3000/precios | head -5   # 3xx hacia /login sin sesión
```

Si tienes navegador disponible, verifica con sesión:

- En el detalle de una oportunidad con precio: registrar un precio menor con
  nota → el precio de la oportunidad se actualiza y el evento aparece en la
  card
- Registrar el mismo precio → muestra el error "El nuevo precio es igual al
  actual."
- `/precios` muestra la bajada en el resumen, en la zona correspondiente y en
  "Bajas recientes" con el % de caída y la liga al detalle

Anota en el resumen final cualquier verificación que no pudiste ejecutar.

---

## Checklist

### Phase 1

- [ ] `logPriceChangeAction` transaccional (evento + actualización de precio)
- [ ] Rechaza precio idéntico al actual

### Phase 2

- [ ] Formulario montado en la card de cambios de precio del detalle
- [ ] La lista de eventos existente se conserva

### Phase 3

- [ ] `/precios` con resumen, zonas y bajas recientes
- [ ] Enlace "Precios" en la navegación

### Phase 4

- [ ] `pnpm typecheck && pnpm lint && pnpm build` ✅
- [ ] Commit `feat: price tracking and trends (task 012)`
- [ ] Redirect sin sesión verificado

---

## Do NOT Do

- Do NOT tocar `prisma/schema.prisma` ni generar migraciones
- Do NOT instalar librerías de gráficas
- Do NOT permitir editar o borrar eventos de precio históricos
- Do NOT detectar precios automáticamente ni scrapeando
- Do NOT enviar alertas/notificaciones de cambios de precio
- Do NOT modificar las fórmulas de KPIs del dashboard ni los entregables diarios
