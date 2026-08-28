# Task 007: Importación CSV e ingestión de alertas

## LLM Agent Directives

You are building the **bulk ingestion layer** of Centinela to achieve phase 2 of
the ingestion strategy (CONTEXT.md sección 7): load opportunities in bulk via CSV
and pull detections from Google Alerts through RSS — without any scraping.

Lee primero `.tasks/CONTEXT.md` (secciones 6 y 7). El proyecto existe en `centinela/`
con las tareas 001–006 completas. Trabaja desde `centinela/`. Sigue los patrones
establecidos (server actions + `requireUser()` + `revalidatePath`).

**Goals:**
1. Página `/importar` con enlace en la navegación
2. Importador de CSV de oportunidades: validación por fila, simulacro, deduplicación
   por URL, fuentes auto-creadas y reporte de errores
3. Plantilla CSV descargable
4. Sincronización de Google Alerts vía RSS: cada `<item>` nuevo se registra como
   oportunidad en estatus DETECTED
5. Quality gates verdes al final

**Rules:**
- DO NOT modificar `prisma/schema.prisma` ni crear migraciones
- DO NOT construir edición de oportunidades (las detecciones se corrigen al validar;
  es candidato a tarea futura)
- DO NOT crear webhooks, endpoints API públicos, IMAP/email ni cron jobs
- DO NOT hacer scraping de portales ni redes sociales
- DO NOT guardar archivos en disco — el CSV se procesa en memoria (límite 2 MB)
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio

---

## Phase 1: Dependencias

RUN:
```bash
pnpm add papaparse fast-xml-parser
pnpm add -D @types/papaparse
```

VERIFY: `pnpm typecheck` pasa.

---

### Implementation notes

- CSV encoding: expect UTF-8 encoded CSVs; callers should upload UTF-8 to avoid character corruption. If supporting other encodings becomes necessary, document the expected charset and reject mismatched encodings with a clear error.
- URL normalization: before deduplication normalize `liga`/`sourceUrl` by removing common tracking query params (UTM), trimming trailing slashes, and lowercasing host/path. This reduces false negatives when checking existing `sourceUrl` values in the DB.


## Phase 2: Acción de importación CSV

**File:** `centinela/src/app/(app)/importar/actions.ts` (CREATE)
```typescript
"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { XMLParser } from "fast-xml-parser";
import { OperationType, PropertyType } from "@prisma/client";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_REPORTED_ERRORS = 50;

function normalizeText(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const TYPE_BY_LABEL: Record<string, PropertyType> = {
  casa: "HOUSE",
  departamento: "APARTMENT",
  terreno: "LAND",
  "local comercial": "COMMERCIAL",
  local: "COMMERCIAL",
  bodega: "WAREHOUSE",
  desarrollo: "DEVELOPMENT",
  inversion: "INVESTMENT",
  otro: "OTHER",
};

const OPERATION_BY_LABEL: Record<string, OperationType> = {
  venta: "SALE",
  renta: "RENT",
};

export type ImportResult = {
  error: string | null;
  imported: number;
  duplicates: number;
  errors: { row: number; message: string }[];
  dryRun: boolean;
  done: boolean;
};

const EMPTY_IMPORT: ImportResult = {
  error: null,
  imported: 0,
  duplicates: 0,
  errors: [],
  dryRun: false,
  done: false,
};

export async function importCsvAction(
  _prev: ImportResult | null,
  formData: FormData,
): Promise<ImportResult> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...EMPTY_IMPORT, error: "Selecciona un archivo CSV." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ...EMPTY_IMPORT, error: "El archivo supera el límite de 2 MB." };
  }
  const dryRun = formData.get("dryRun") === "on";

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeText(h),
  });

  const headers = parsed.meta.fields ?? [];
  const missing = ["titulo", "tipo", "operacion"].filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      ...EMPTY_IMPORT,
      error: `Faltan columnas obligatorias: ${missing.join(", ")}. Usa la plantilla.`,
    };
  }
  if (parsed.data.length === 0) {
    return { ...EMPTY_IMPORT, error: "El archivo no contiene filas de datos." };
  }

  type ValidRow = {
    title: string;
    description?: string;
    propertyType: PropertyType;
    operation: OperationType;
    price?: number;
    zone?: string;
    address?: string;
    sourceUrl?: string;
    sourceNotes?: string;
    sourceName?: string;
  };

  const validRows: ValidRow[] = [];
  const errors: { row: number; message: string }[] = [];
  let duplicates = 0;
  const seenUrls = new Set<string>();
  const candidateUrls: string[] = [];

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2; // la fila 1 es el encabezado
    const get = (key: string) => {
      const v = raw[key];
      return typeof v === "string" ? v.trim() : "";
    };

    const title = get("titulo");
    const propertyType = TYPE_BY_LABEL[normalizeText(get("tipo"))];
    const operation = OPERATION_BY_LABEL[normalizeText(get("operacion"))];
    const priceRaw = get("precio").replace(/[$,\s]/g, "");
    const zone = get("zona");
    const address = get("direccion");
    const sourceUrl = get("liga");
    const sourceName = get("fuente");
    const sourceNotes = get("notas_deteccion");
    const description = get("descripcion");

    const rowErrors: string[] = [];
    if (title.length < 5) rowErrors.push("titulo vacío o menor a 5 caracteres");
    if (!propertyType) rowErrors.push(`tipo "${get("tipo")}" no reconocido`);
    if (!operation) rowErrors.push(`operación "${get("operacion")}" no reconocida`);

    let price: number | undefined;
    if (priceRaw !== "") {
      const n = Number(priceRaw);
      if (Number.isNaN(n) || n <= 0) rowErrors.push("precio no es un número mayor a cero");
      else price = n;
    }

    if (sourceUrl) {
      try {
        const u = new URL(sourceUrl);
        if (u.protocol !== "http:" && u.protocol !== "https:") rowErrors.push("liga debe ser http(s)");
      } catch {
        rowErrors.push("liga no es una URL válida");
      }
      if (seenUrls.has(sourceUrl)) {
        duplicates += 1; // duplicada dentro del mismo archivo
        return;
      }
      seenUrls.add(sourceUrl);
      candidateUrls.push(sourceUrl);
    }

    if (rowErrors.length > 0) {
      if (errors.length < MAX_REPORTED_ERRORS) {
        errors.push({ row: rowNumber, message: rowErrors.join("; ") });
      }
      return;
    }

    validRows.push({
      title,
      description: description || undefined,
      propertyType: propertyType!,
      operation: operation!,
      price,
      zone: zone || undefined,
      address: address || undefined,
      sourceUrl: sourceUrl || undefined,
      sourceNotes: sourceNotes || undefined,
      sourceName: sourceName || undefined,
    });
  });

  // Deduplicación contra la base de datos
  let existingSet = new Set<string>();
  if (candidateUrls.length > 0) {
    const existing = await prisma.opportunity.findMany({
      where: { sourceUrl: { in: candidateUrls } },
      select: { sourceUrl: true },
    });
    existingSet = new Set(existing.map((o) => o.sourceUrl ?? ""));
  }
  const rowsToImport = validRows.filter((r) => !r.sourceUrl || !existingSet.has(r.sourceUrl));
  duplicates += validRows.length - rowsToImport.length;

  if (dryRun) {
    return { error: null, imported: rowsToImport.length, duplicates, errors, dryRun: true, done: true };
  }
  if (rowsToImport.length === 0) {
    return { error: null, imported: 0, duplicates, errors, dryRun: false, done: true };
  }

  let sourceIdMap = new Map<string, string>();

  await prisma.$transaction(async (tx) => {
    // Fuentes: buscar existentes y crear las que falten (kind OTHER)
    const names = [...new Set(rowsToImport.map((r) => r.sourceName).filter((n): n is string => !!n))];
    if (names.length > 0) {
      const found = await tx.source.findMany({
        where: { name: { in: names } },
        select: { id: true, name: true },
      });
      sourceIdMap = new Map(found.map((s) => [s.name, s.id]));
      for (const name of names) {
        if (!sourceIdMap.has(name)) {
          const created = await tx.source.create({ data: { name, kind: "OTHER" } });
          sourceIdMap.set(name, created.id);
        }
      }
    }

    for (const r of rowsToImport) {
      const opp = await tx.opportunity.create({
        data: {
          title: r.title,
          description: r.description,
          propertyType: r.propertyType,
          operation: r.operation,
          price: r.price,
          zone: r.zone,
          address: r.address,
          sourceUrl: r.sourceUrl,
          sourceNotes: r.sourceNotes,
          sourceId: r.sourceName ? sourceIdMap.get(r.sourceName) : undefined,
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
          note: "Importación CSV",
          userId: user.id,
        },
      });
    }
  });

  revalidatePath("/oportunidades");
  revalidatePath("/");
  revalidatePath("/importar");
  return { error: null, imported: rowsToImport.length, duplicates, errors, dryRun: false, done: true };
}
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 3: Plantilla, formulario CSV, página y navegación

### 3.1 Plantilla descargable

**File:** `centinela/src/app/(app)/importar/plantilla/route.ts` (CREATE)
```typescript
import { requireUser } from "@/lib/guards";

export async function GET() {
  await requireUser();

  const csv = [
    "titulo,tipo,operacion,precio,zona,direccion,liga,fuente,notas_deteccion,descripcion",
    "Casa en San Mateo Oxtotitlan 3 recamaras,Casa,Venta,2500000,Toluca Norte,Calle Ejemplo 123,https://example.com/publicacion,Facebook Marketplace,site:facebook.com marketplace toluca,Casa remodelada con jardin",
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-oportunidades.csv"',
    },
  });
}
```

### 3.2 Formulario CSV (client)

**File:** `centinela/src/app/(app)/importar/csv-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importCsvAction } from "./actions";

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState(importCsvAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar oportunidades (CSV)</CardTitle>
        <CardDescription>
          Columnas: titulo, tipo, operacion, precio, zona, direccion, liga, fuente,
          notas_deteccion, descripcion. Las filas con error se omiten.{" "}
          <Link href="/importar/plantilla" className="underline">Descargar plantilla</Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={formAction} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="file">Archivo CSV</Label>
            <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="dryRun" className="h-4 w-4" />
            Solo validar (simulacro, sin importar)
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Procesando…" : "Procesar CSV"}
          </Button>
        </form>

        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {state?.done ? (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="font-medium">
              {state.dryRun ? "Simulacro completado" : "Importación completada"}
            </p>
            <p>
              ✅ {state.dryRun ? "Importables" : "Importadas"}: {state.imported} ·
              ♻️ Duplicadas: {state.duplicates} · ⚠️ Errores: {state.errors.length}
            </p>
            {state.errors.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-auto text-xs text-muted-foreground">
                {state.errors.map((e, i) => (
                  <li key={i}>Fila {e.row}: {e.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

### 3.3 Página de importación

**File:** `centinela/src/app/(app)/importar/page.tsx` (CREATE)
```tsx
import { requireUser } from "@/lib/guards";
import { CsvImportForm } from "./csv-form";

export default async function ImportPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importación</h1>
        <p className="text-sm text-muted-foreground">
          Carga oportunidades de forma masiva: CSV (registro completo) o Google
          Alerts vía RSS (detecciones).
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CsvImportForm />
        {/* El formulario de alertas se agrega en la Fase 4 */}
      </div>
    </div>
  );
}
```

### 3.4 Enlace en la navegación

**File:** `centinela/src/components/app-shell.tsx` (MODIFY)

Localiza el arreglo/lista de enlaces de navegación creado en las tareas 001/003
y agrega el elemento `{ href: "/importar", label: "Importar" }` junto a los demás,
conservando todo lo existente.

VERIFY: `pnpm typecheck && pnpm build` pasan; `/importar/plantilla` responde el CSV.

---

## Phase 4: Sincronización de Google Alerts (RSS)

### 4.1 Agregar la acción

**File:** `centinela/src/app/(app)/importar/actions.ts` (APPEND)
```typescript
export type AlertResult = {
  error: string | null;
  imported: number;
  duplicates: number;
  done: boolean;
};

const EMPTY_ALERT: AlertResult = { error: null, imported: 0, duplicates: 0, done: false };

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function syncAlertsAction(
  _prev: AlertResult | null,
  formData: FormData,
): Promise<AlertResult> {
  const user = await requireUser();

  const rawUrl = String(formData.get("feedUrl") ?? "").trim();
  let feedUrl: URL;
  try {
    feedUrl = new URL(rawUrl);
    if (feedUrl.protocol !== "http:" && feedUrl.protocol !== "https:") throw new Error();
  } catch {
    return { ...EMPTY_ALERT, error: "La URL del feed RSS no es válida." };
  }

  let xmlText: string;
  try {
    const res = await fetch(feedUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Centinela/1.0" },
    });
    if (!res.ok) return { ...EMPTY_ALERT, error: `El feed respondió con estado ${res.status}.` };
    xmlText = await res.text();
  } catch {
    return { ...EMPTY_ALERT, error: "No se pudo descargar el feed. Verifica la URL y tu conexión." };
  }
  if (xmlText.length > 1_000_000) {
    return { ...EMPTY_ALERT, error: "El feed supera el límite de tamaño (1 MB)." };
  }

  let items: unknown[] = [];
  try {
    const doc = new XMLParser({ ignoreAttributes: true }).parse(xmlText);
    const raw = doc?.rss?.channel?.item;
    items = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
  } catch {
    return { ...EMPTY_ALERT, error: "El contenido no parece ser un RSS válido." };
  }
  if (items.length === 0) {
    return { ...EMPTY_ALERT, error: "El feed no contiene elementos <item>." };
  }

  type AlertItem = { title: string; link?: string; notes?: string };
  const parsedItems: AlertItem[] = items
    .slice(0, 100)
    .map((it) => {
      const item = it as Record<string, unknown>;
      return {
        title: stripHtml(String(item.title ?? "")).slice(0, 200),
        link: typeof item.link === "string" ? item.link.trim() : undefined,
        notes: stripHtml(String(item.description ?? "")).slice(0, 500) || undefined,
      };
    })
    .filter((it) => it.title.length >= 5);

  const links = parsedItems.map((i) => i.link).filter((l): l is string => !!l);
  const existingLinks =
    links.length > 0
      ? new Set(
          (
            await prisma.opportunity.findMany({
              where: { sourceUrl: { in: links } },
              select: { sourceUrl: true },
            })
          ).map((o) => o.sourceUrl ?? ""),
        )
      : new Set<string>();

  const seen = new Set<string>();
  const fresh = parsedItems.filter((it) => {
    if (!it.link) return true;
    if (seen.has(it.link) || existingLinks.has(it.link)) return false;
    seen.add(it.link);
    return true;
  });
  const duplicates = parsedItems.length - fresh.length;

  if (fresh.length === 0) {
    return { error: null, imported: 0, duplicates, done: true };
  }

  await prisma.$transaction(async (tx) => {
    const source = await tx.source.upsert({
      where: { name: "Google Alerts" },
      update: {},
      create: { name: "Google Alerts", kind: "GOOGLE_ALERT" },
    });

    for (const item of fresh) {
      const opp = await tx.opportunity.create({
        data: {
          title: item.title,
          // Detección cruda: el analista corrige tipo/operación al validar
          propertyType: "OTHER",
          operation: "SALE",
          status: "DETECTED",
          sourceUrl: item.link,
          sourceNotes: item.notes,
          sourceId: source.id,
          registeredById: user.id,
          assignedToId: user.id,
        },
      });
      await tx.stageHistory.create({
        data: {
          opportunityId: opp.id,
          fromStatus: null,
          toStatus: "DETECTED",
          note: "Sincronización de alerta RSS",
          userId: user.id,
        },
      });
    }
  });

  revalidatePath("/oportunidades");
  revalidatePath("/");
  revalidatePath("/importar");
  return { error: null, imported: fresh.length, duplicates, done: true };
}
```

### 4.2 Formulario de alertas (client)

**File:** `centinela/src/app/(app)/importar/alerts-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncAlertsAction } from "./actions";

export function AlertsSyncForm() {
  const [state, formAction, pending] = useActionState(syncAlertsAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Alerts (RSS)</CardTitle>
        <CardDescription>
          Crea tu alerta en Google Alerts con entrega “RSS”, pega la liga del feed y
          sincroniza. Cada entrada nueva se registra como oportunidad en estatus “Detectada”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={formAction} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="feedUrl">URL del feed RSS</Label>
            <Input id="feedUrl" name="feedUrl" type="url" required
              placeholder="https://www.google.com/alerts/feeds/…" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Sincronizando…" : "Sincronizar ahora"}
          </Button>
        </form>

        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {state?.done ? (
          <p className="rounded-md border p-3 text-sm">
            Sincronización completada: {state.imported} nuevas · {state.duplicates} duplicadas omitidas.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

### 4.3 Montar el formulario en la página

**File:** `centinela/src/app/(app)/importar/page.tsx` (MODIFY)

FIND:
```tsx
{/* El formulario de alertas se agrega en la Fase 4 */}
```
CHANGE TO:
```tsx
<AlertsSyncForm />
```
y agrega el import de `AlertsSyncForm`.

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 5: Gates, commit y verify final

RUN:
```bash
pnpm typecheck
pnpm lint
pnpm build
git add -A && git commit -m "feat: CSV import and alerts ingestion (task 007)"
```

RUN (verificación de runtime):
```bash
docker compose up -d
pnpm dev &
sleep 8
curl -sI http://localhost:3000/importar | head -5   # 3xx hacia /login sin sesión
```

Si tienes navegador disponible, verifica con sesión:
- Descargar la plantilla y editarla con 2 filas válidas + 1 con tipo inválido
- "Solo validar" reporta 2 importables y 1 error sin tocar la BD
- Importar: crea 2 oportunidades (visibles en `/oportunidades` con historial "Importación CSV")
- Reimportar el mismo archivo: 0 importadas, 2 duplicadas (si traen liga)
- La sincronización RSS se prueba solo si hay acceso a internet; si no, anótalo

Anota en el resumen final cualquier verificación manual que no pudiste ejecutar.

---

## Checklist

### Phase 1
- [ ] papaparse + fast-xml-parser instalados

### Phase 2
- [ ] `importCsvAction` valida filas, deduplica y auto-crea fuentes
- [ ] Simulacro no escribe en BD
- [ ] Errores reportados con número de fila (máx. 50)

### Phase 3
- [ ] `/importar` con formulario CSV y liga en AppShell
- [ ] `/importar/plantilla` descarga el CSV

### Phase 4
- [ ] `syncAlertsAction` con timeout, límite de tamaño y deduplicación
- [ ] Detecciones entran como DETECTED con `StageHistory`

### Phase 5
- [ ] `pnpm typecheck && pnpm lint && pnpm build` ✅
- [ ] Commit `feat: CSV import and alerts ingestion (task 007)`

---

## Do NOT Do

- Do NOT tocar `prisma/schema.prisma` ni generar migraciones
- Do NOT construir edición de oportunidades
- Do NOT crear webhooks, endpoints API públicos ni tokens de integración
- Do NOT leer correo (IMAP/POP3) ni configurar cuentas de email
- Do NOT programar sincronizaciones automáticas (cron/schedulers)
- Do NOT guardar los archivos CSV en disco ni subirlos a almacenamiento
- Do NOT importar contactos, citas ni alianzas por CSV
- Do NOT hacer scraping de portales ni redes sociales
