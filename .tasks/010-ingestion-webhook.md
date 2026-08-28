# Task 010: Webhook de ingestión para automatizaciones

## LLM Agent Directives

You are building the **HTTP ingestion endpoint** of Centinela to achieve phase 3
of the ingestion strategy (CONTEXT.md sección 7): external automations (Make,
Zapier, Distill.io) register opportunities directly via an authenticated webhook.

Lee primero `.tasks/CONTEXT.md` (sección 7) y los specs de las tareas 003
(middleware de auth) y 007 (reglas de ingestión: deduplicación por URL, fuentes
auto-creadas, estatus DETECTED/REGISTERED). El proyecto existe en `centinela/`
con las tareas 001–009 completas. Trabaja desde `centinela/`.

**Goals:**
1. `INGEST_TOKEN` en el entorno (`.env` y `.env.example`)
2. Endpoint `POST /api/ingest/opportunities` autenticado por Bearer token,
   con validación Zod, deduplicación por URL y contacto/fuente opcionales
3. `GET /api/ingest/opportunities` de diagnóstico (sin datos sensibles)
4. Middleware actualizado para permitir `/api/ingest/*` sin sesión
5. Documentación del webhook visible en `/importar` y en el README
6. Quality gates verdes al final

**Rules:**
- DO NOT modificar `prisma/schema.prisma` ni crear migraciones
- DO NOT crear más endpoints ni un API CRUD general
- DO NOT usar autenticación por sesión en este endpoint — solo Bearer token
- DO NOT registrar el token ni secretos en logs
- DO NOT tocar los módulos existentes salvo el middleware y la página `/importar`
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio

---

## Phase 1: Token de entorno

RUN: `openssl rand -hex 32`

**File:** `centinela/.env` (AGREGAR)
```
INGEST_TOKEN="<pega aquí el valor generado>"
```

**File:** `centinela/.env.example` (AGREGAR)
```
INGEST_TOKEN="genera uno con: openssl rand -hex 32"
```

---

## Phase 2: Utilidades y endpoint

### 2.1 Mapas de ingestión

**File:** `centinela/src/lib/ingest.ts` (CREATE)
```typescript
import type { OperationType, PropertyType } from "@prisma/client";

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Acepta claves de enum y etiquetas en español
export const TYPE_BY_LABEL: Record<string, PropertyType> = {
  house: "HOUSE",
  casa: "HOUSE",
  apartment: "APARTMENT",
  departamento: "APARTMENT",
  land: "LAND",
  terreno: "LAND",
  commercial: "COMMERCIAL",
  "local comercial": "COMMERCIAL",
  local: "COMMERCIAL",
  warehouse: "WAREHOUSE",
  bodega: "WAREHOUSE",
  development: "DEVELOPMENT",
  desarrollo: "DEVELOPMENT",
  investment: "INVESTMENT",
  inversion: "INVESTMENT",
  other: "OTHER",
  otro: "OTHER",
};

export const OPERATION_BY_LABEL: Record<string, OperationType> = {
  sale: "SALE",
  venta: "SALE",
  rent: "RENT",
  renta: "RENT",
};
```

### 2.2 Route handler

**File:** `centinela/src/app/api/ingest/opportunities/route.ts` (CREATE)
```typescript
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { OperationType, PropertyType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeText, OPERATION_BY_LABEL, TYPE_BY_LABEL } from "@/lib/ingest";

const MAX_ITEMS = 100;

const contactSchema = z.object({
  name: z.string().min(2).max(150),
  kind: z.enum(["OWNER", "BROKER", "ALLIANCE", "OTHER"]).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(190).optional(),
  socialHandle: z.string().max(120).optional(),
});

const itemSchema = z.object({
  title: z.string().min(5).max(200),
  type: z.string().max(60).optional(),        // enum key o etiqueta ES; default OTHER
  operation: z.string().max(60).optional(),   // enum key o etiqueta ES; default SALE
  price: z.number().positive().optional(),
  zone: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  sourceUrl: z.string().url().max(500).optional(),
  sourceNotes: z.string().max(2000).optional(),
  source: z.string().max(120).optional(),     // nombre de fuente; se crea si no existe
  status: z.enum(["DETECTED", "REGISTERED"]).optional(), // default DETECTED
  contact: contactSchema.optional(),
});

const payloadSchema = z.object({
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
});

function isValidToken(req: Request): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return false;

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/ingest/opportunities",
    auth: "Authorization: Bearer <INGEST_TOKEN>",
    docs: "Documentación completa en la página /importar de Centinela.",
  });
}

export async function POST(req: Request) {
  if (!isValidToken(req)) {
    return NextResponse.json(
      { ok: false, error: "Token inválido o ausente." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "El cuerpo no es JSON válido." }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Payload inválido.", details: parsed.error.issues.slice(0, 10) },
      { status: 400 },
    );
  }

  const errors: { index: number; message: string }[] = [];

  type Prepared = {
    item: z.infer<typeof itemSchema>;
    propertyType: PropertyType;
    operation: OperationType;
  };
  const prepared: Prepared[] = [];

  parsed.data.items.forEach((item, index) => {
    const propertyType = TYPE_BY_LABEL[normalizeText(item.type ?? "OTHER")];
    const operation = OPERATION_BY_LABEL[normalizeText(item.operation ?? "SALE")];
    if (!propertyType) {
      errors.push({ index, message: `type "${item.type}" no reconocido` });
      return;
    }
    if (!operation) {
      errors.push({ index, message: `operation "${item.operation}" no reconocida` });
      return;
    }
    prepared.push({ item, propertyType, operation });
  });

  // Deduplicación por URL: dentro del payload y contra la BD
  const urls = prepared.map((p) => p.item.sourceUrl).filter((u): u is string => !!u);
  const seen = new Set<string>();
  let duplicates = 0;
  const fresh = prepared.filter((p) => {
    if (!p.item.sourceUrl) return true;
    if (seen.has(p.item.sourceUrl)) {
      duplicates += 1;
      return false;
    }
    seen.add(p.item.sourceUrl);
    return true;
  });

  let existingSet = new Set<string>();
  if (urls.length > 0) {
    const existing = await prisma.opportunity.findMany({
      where: { sourceUrl: { in: urls } },
      select: { sourceUrl: true },
    });
    existingSet = new Set(existing.map((o) => o.sourceUrl ?? ""));
  }
  const toImport = fresh.filter((p) => !p.item.sourceUrl || !existingSet.has(p.item.sourceUrl));
  duplicates += fresh.length - toImport.length;

  if (toImport.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const { item, propertyType, operation } of toImport) {
        // Contacto: reutilizar por teléfono o email; si no, crear
        let contactId: string | undefined;
        if (item.contact) {
          const c = item.contact;
          const byPhone = c.phone
            ? await tx.contact.findFirst({ where: { phone: c.phone }, select: { id: true } })
            : null;
          const byEmail =
            !byPhone && c.email
              ? await tx.contact.findFirst({ where: { email: c.email }, select: { id: true } })
              : null;
          const existingContact = byPhone ?? byEmail;

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            const created = await tx.contact.create({
              data: {
                name: c.name,
                kind: c.kind ?? "OWNER",
                phone: c.phone,
                email: c.email,
                socialHandle: c.socialHandle,
              },
              select: { id: true },
            });
            contactId = created.id;
          }
        }

        // Fuente: reutilizar por nombre; si no, crear
        let sourceId: string | undefined;
        if (item.source) {
          const existingSource = await tx.source.findUnique({ where: { name: item.source } });
          if (existingSource) {
            sourceId = existingSource.id;
          } else {
            const created = await tx.source.create({ data: { name: item.source, kind: "OTHER" } });
            sourceId = created.id;
          }
        }

        const status = item.status ?? "DETECTED";
        const opp = await tx.opportunity.create({
          data: {
            title: item.title,
            propertyType,
            operation,
            price: item.price,
            zone: item.zone,
            address: item.address,
            sourceUrl: item.sourceUrl,
            sourceNotes: item.sourceNotes,
            sourceId,
            contactId,
            status,
          },
        });
        await tx.stageHistory.create({
          data: {
            opportunityId: opp.id,
            fromStatus: null,
            toStatus: status,
            note: "Ingestión por webhook",
          },
        });
      }
    });
  }

  return NextResponse.json({ ok: true, imported: toImport.length, duplicates, errors });
}
```

### 2.3 Whitelist en el middleware

**File:** `centinela/src/middleware.ts` (MODIFY)

FIND:
```typescript
const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

if (isAuthApi) return NextResponse.next();
```
CHANGE TO:
```typescript
const isAuthApi = nextUrl.pathname.startsWith("/api/auth");
const isIngestApi = nextUrl.pathname.startsWith("/api/ingest");

if (isAuthApi || isIngestApi) return NextResponse.next();
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

### Implementation notes

- Example responses: successful `POST` returns HTTP 200 with JSON `{ ok: true, imported: <number>, duplicates: <number>, errors: [ ... ] }`. On authentication failure return HTTP 401 with `{ ok: false, error: "Token inválido o ausente." }`. `GET` returns HTTP 200 and non-sensitive diagnostics. Do not log secrets or token values.
- URL normalization: normalize `sourceUrl` before deduplication (strip UTM/tracking query params, remove trailing slash, and lowercase host/path) to reduce false negatives when checking DB for existing records.


## Phase 3: Documentación

### 3.1 Tarjeta en `/importar`

**File:** `centinela/src/app/(app)/importar/page.tsx` (MODIFY)

Dentro del grid existente (junto a `CsvImportForm` y `AlertsSyncForm`),
agrega esta tercera Card (contenido estático, sin componente client):

```tsx
<Card>
  <CardHeader>
    <CardTitle>Webhook (Make / Zapier / Distill.io)</CardTitle>
    <CardDescription>
      Registra oportunidades por HTTP desde tus automatizaciones externas.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-3 text-sm">
    <p>
      <span className="font-mono text-xs">POST /api/ingest/opportunities</span>
    </p>
    <p>
      Header: <span className="font-mono text-xs">Authorization: Bearer &lt;INGEST_TOKEN&gt;</span>
    </p>
    <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{`{
  "items": [
    {
      "title": "Casa en Toluca Centro, 3 recámaras",
      "type": "HOUSE",
      "operation": "SALE",
      "price": 2500000,
      "zone": "Toluca Centro",
      "sourceUrl": "https://ejemplo.com/publicacion",
      "source": "Distill.io",
      "contact": { "name": "Juan Pérez", "phone": "7221234567" }
    }
  ]
}`}</pre>
    <p className="text-xs text-muted-foreground">
      “title” es obligatorio (mín. 5 caracteres). “type”/“operation” aceptan enum
      (HOUSE, RENT…) o etiqueta en español y por defecto valen OTHER/SALE.
      Máximo 100 elementos por llamada; las duplicadas por URL se omiten.
    </p>
  </CardContent>
</Card>
```

Ajusta los imports de `Card*` si hacen falta.

### 3.2 README

**File:** `centinela/README.md` (AGREGAR sección "Webhook de ingestión")

En español: endpoint, header de autenticación, ejemplo curl:

```bash
curl -X POST http://localhost:3000/api/ingest/opportunities \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"title":"Prueba de webhook para Centinela","type":"HOUSE","operation":"SALE"}]}'
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 4: Gates, commit y verify final

RUN:
```bash
pnpm typecheck
pnpm lint
pnpm build
git add -A && git commit -m "feat: ingestion webhook for automations (task 010)"
```

RUN (verificación de runtime — esta tarea SÍ se puede probar sin navegador):
```bash
docker compose up -d
pnpm dev &
sleep 8

# 1) Sin token → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/ingest/opportunities \
  -H "Content-Type: application/json" -d '{"items":[]}'

# 2) GET de diagnóstico → 200
curl -s http://localhost:3000/api/ingest/opportunities

# 3) Con token → importa 1
source .env && curl -s -X POST http://localhost:3000/api/ingest/opportunities \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"title":"Prueba de webhook para Centinela","type":"HOUSE","operation":"SALE","source":"Prueba webhook"}]}'

# 4) Repetir la llamada 3 → imported: 0 (si trae sourceUrl) o importe según URL;
#    payload inválido ({"items":[]}) → 400
```

VERIFY esperado: 401 sin token · 200 en GET · `{"ok":true,"imported":1,...}` con token.
Con sesión en el navegador, confirma que la oportunidad de prueba aparece en `/oportunidades`.

Anota en el resumen final cualquier verificación que no pudiste ejecutar.

---

## Checklist

### Phase 1
- [ ] `INGEST_TOKEN` en `.env` y `.env.example`

### Phase 2
- [ ] `src/lib/ingest.ts` con mapas bilingües
- [ ] Endpoint POST con Zod, token, dedup y contacto/fuente opcionales
- [ ] GET de diagnóstico
- [ ] Middleware permite `/api/ingest/*` sin sesión (y nada más cambió)

### Phase 3
- [ ] Tarjeta de documentación en `/importar`
- [ ] README con ejemplo curl

### Phase 4
- [ ] `pnpm typecheck && pnpm lint && pnpm build` ✅
- [ ] Commit `feat: ingestion webhook for automations (task 010)`
- [ ] Pruebas curl: 401 sin token, 200 GET, imported 1 con token

---

## Do NOT Do

- Do NOT tocar `prisma/schema.prisma` ni generar migraciones
- Do NOT crear endpoints adicionales (PUT/DELETE, CRUDs, otros recursos)
- Do NOT aceptar autenticación por sesión ni cookies en este endpoint
- Do NOT imprimir el token ni payloads completos en logs
- Do NOT implementar rate limiting con librerías (el tope de 100 items basta en MVP)
- Do NOT implementar firmas HMAC ni reintentos/colas (candidatos futuros)
- Do NOT modificar los importadores CSV/RSS de la tarea 007
