# Task 011: Exportación CSV del inventario

## LLM Agent Directives

You are adding **CSV export** to Centinela to achieve the outbound side of the
inventory loop: advisors download the active inventory (or any filtered slice of
opportunities) to publish on portals or share with allies. The exported file uses
the same base columns as the import template, so it can be re-imported.

Lee primero `.tasks/CONTEXT.md` y los specs de las tareas 004 (listado de
oportunidades) y 007 (plantilla de importación: las 10 columnas base). El proyecto
existe en `centinela/` con las tareas 001–010 completas. Trabaja desde `centinela/`.

**Goals:**
1. `GET /exportar/oportunidades` protegido por sesión, que responde un CSV
2. `scope=inventario` (default) exporta solo estatus INVENTORY;
   `scope=todas` exporta todo excepto DISCARDED, con filtros opcionales
   (`status`, `propertyType`, `operation`, `q`)
3. Columnas: las 10 de la plantilla de importación + estatus, calificación,
   contacto, teléfono y fecha de registro
4. Botones de exportación en el header del listado de oportunidades
5. Quality gates verdes al final

**Rules:**
- DO NOT modificar `prisma/schema.prisma` ni crear migraciones
- DO NOT instalar librerías de XLSX/PDF ni generar otros formatos
- DO NOT exportar contactos, citas, alianzas ni reportes — solo oportunidades
- DO NOT crear endpoints de exportación adicionales
- DO NOT tocar el importador de la tarea 007
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio

---

## Recomendaciones de mejora del spec

Antes de implementar, conviene dejar estos puntos explícitos para evitar ambigüedades y que el CSV quede alineado con el resto del sistema:

- Reusar `requireUser()` del módulo de auth y el patrón de `prisma` del proyecto para mantener consistencia con las tareas 003–004, en vez de introducir un flujo de autenticación diferente.
- Definir un contrato único de filtros entre la página de oportunidades y el endpoint de exportación (`scope`, `status`, `propertyType`, `operation`, `q`) y documentar que `scope=todas` debe excluir `DISCARDED` aunque el usuario mande ese valor.
- Mantener la lista de 15 columnas como fuente de verdad y, si es posible, reutilizarla desde un helper compartido con la plantilla de importación para evitar que el exporte y el importador se desincronicen.
- Asegurar que los valores numéricos y vacíos se serialicen de forma estable para Excel (por ejemplo, `price` sin perder precisión y celdas vacías como `""`, no `undefined`).
- Agregar un comportamiento explícito cuando se supere el límite de 5,000 filas, por ejemplo un header de conteo (`X-Export-Row-Count`) o una nota en el spec sobre la truncación esperada.
- Incluir una prueba de aceptación simple que verifique BOM UTF-8, encabezados exactos, acentos y una fila con comillas o saltos de línea.
- Si la página de oportunidades ya usa query params para filtros, el botón de exportación debe construir la URL a partir de los filtros activos del URL actual y no de un estado separado.

## Phase 1: Route handler de exportación

**File:** `centinela/src/app/(app)/exportar/oportunidades/route.ts` (CREATE)
```typescript
import { Prisma, OperationType, OpportunityStatus, PropertyType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toLocalISODate } from "@/lib/format";
import {
  OPERATION_LABELS, OPPORTUNITY_STATUS_LABELS, PROPERTY_TYPE_LABELS, QUALIFICATION_LABELS,
} from "@/lib/labels";

const MAX_ROWS = 5000;

// Las primeras 10 columnas coinciden con la plantilla de importación (tarea 007):
// el archivo exportado puede reimportarse tal cual.
const HEADERS = [
  "titulo", "tipo", "operacion", "precio", "zona", "direccion", "liga", "fuente",
  "notas_deteccion", "descripcion", "estatus", "calificacion", "contacto",
  "telefono", "fecha_registro",
];

function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("No autorizado", { status: 401 });
  }

  const url = new URL(req.url);
  const scopeTodas = url.searchParams.get("scope") === "todas";

  const statusParam = url.searchParams.get("status") ?? "";
  const typeParam = url.searchParams.get("propertyType") ?? "";
  const operationParam = url.searchParams.get("operation") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();

  const status =
    statusParam in OPPORTUNITY_STATUS_LABELS ? (statusParam as OpportunityStatus) : undefined;
  const propertyType =
    typeParam in PROPERTY_TYPE_LABELS ? (typeParam as PropertyType) : undefined;
  const operation =
    operationParam in OPERATION_LABELS ? (operationParam as OperationType) : undefined;

  const where: Prisma.OpportunityWhereInput = {
    status: scopeTodas ? (status ?? { not: "DISCARDED" }) : "INVENTORY",
    ...(propertyType ? { propertyType } : {}),
    ...(operation ? { operation } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { zone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.opportunity.findMany({
    where,
    include: { source: true, contact: true },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  const lines = rows.map((o) =>
    [
      o.title,
      PROPERTY_TYPE_LABELS[o.propertyType],
      OPERATION_LABELS[o.operation],
      o.price ? o.price.toString() : "",
      o.zone ?? "",
      o.address ?? "",
      o.sourceUrl ?? "",
      o.source?.name ?? "",
      o.sourceNotes ?? "",
      o.description ?? "",
      OPPORTUNITY_STATUS_LABELS[o.status],
      o.qualification ? QUALIFICATION_LABELS[o.qualification] : "",
      o.contact?.name ?? "",
      o.contact?.phone ?? "",
      toLocalISODate(o.createdAt),
    ]
      .map(escapeCell)
      .join(","),
  );

  // BOM para que Excel abra los acentos correctamente
  const csv = "\uFEFF" + [HEADERS.join(","), ...lines].join("\r\n");
  const filename = `centinela-${scopeTodas ? "oportunidades" : "inventario"}-${toLocalISODate(new Date())}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

### Implementación recomendada

- Usar `requireUser()` (o el helper equivalente de auth) en vez de consultar `auth()` directamente para mantener el patrón del resto del proyecto.
- El filtro por `status` solo debe aplicarse cuando el valor corresponde a un enum válido; si llega un valor inválido, ignorarlo y no romper la query.
- Para evitar desalineaciones, mantener las 15 columnas en un arreglo compartido y usarlo tanto en el exporte como en la plantilla de importación.
- Añadir un `X-Export-Row-Count` o un mensaje de truncado explícito cuando el resultado supere `MAX_ROWS` para que el usuario sepa que el CSV no es completo.
- Si el proyecto ya define una utilidad de formateo de fechas, usarla también para la fecha del archivo; si no, dejar el formato `AAAA-MM-DD` consistente.

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 2: Botones en el listado de oportunidades

### Recomendación de UX

- El botón de exportación debe aparecer en el mismo header donde ya existe el CTA de creación para no romper el flujo de trabajo del analista.
- Si el listado tiene filtros activos y el usuario cambia de página, el botón debe conservar esos filtros; de lo contrario, el CSV exportado puede parecer inconsistente.
- Considerar un texto más explícito en el CTA, por ejemplo `Exportar inventario` y `Exportar CSV (filtros)` para reducir ambigüedad.

**File:** `centinela/src/app/(app)/oportunidades/page.tsx` (MODIFY)

### 2.1 Construir la liga con los filtros activos

Después de validar los filtros (donde ya existen las variables `q`, `status`,
`propertyType`, `operation`), agrega:

```tsx
const exportParams = new URLSearchParams();
exportParams.set("scope", "todas");
if (status) exportParams.set("status", status);
if (propertyType) exportParams.set("propertyType", propertyType);
if (operation) exportParams.set("operation", operation);
if (q) exportParams.set("q", q);
const exportHref = `/exportar/oportunidades?${exportParams.toString()}`;
```

### 2.2 Agregar los botones en el header

Junto al botón existente "+ Nueva oportunidad", agrega (conserva el existente):

```tsx
<Button asChild variant="outline">
  <Link href={exportHref}>Exportar CSV</Link>
</Button>
<Button asChild variant="outline">
  <Link href="/exportar/oportunidades">Exportar inventario</Link>
</Button>
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 3: Gates, commit y verify final

### Recomendación de verificación

- Agregar una verificación de runtime mínima que pruebe que la ruta responde con `401` sin sesión y con `200` con sesión válida.
- Si el entorno local no está levantado, documentar de forma explícita qué verificaciones no se pudieron ejecutar en lugar de asumir que pasaron.
- Al terminar, capturar el resultado de `pnpm typecheck`, `pnpm lint`, `pnpm build` y el commit en el resumen final para dejar trazabilidad.

RUN:
```bash
pnpm typecheck
pnpm lint
pnpm build
git add -A && git commit -m "feat: CSV export of inventory (task 011)"
```

RUN (verificación de runtime):
```bash
docker compose up -d
pnpm dev &
sleep 8

# Sin sesión → 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/exportar/oportunidades
```

Opcional (verificación con sesión vía curl):
```bash
JAR=$(mktemp)
CSRF=$(curl -s -c "$JAR" http://localhost:3000/api/auth/csrf \
  | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
curl -s -b "$JAR" -c "$JAR" -X POST http://localhost:3000/api/auth/callback/credentials \
  -d "csrfToken=$CSRF&email=admin@centinela.local&password=<SU CONTRASEÑA>" -o /dev/null
curl -s -b "$JAR" "http://localhost:3000/exportar/oportunidades?scope=todas" | head -3
```

Si tienes navegador disponible, verifica con sesión:
- "Exportar inventario" descarga `centinela-inventario-AAAA-MM-DD.csv`
- "Exportar CSV" respeta los filtros activos del listado
- El archivo abre en Excel con acentos correctos y 15 columnas
- Una oportunidad avanzada a INVENTORY aparece en el inventario exportado

Anota en el resumen final cualquier verificación que no pudiste ejecutar.

---

## Checklist

### Phase 1
- [ ] Route handler con sesión, scopes y filtros
- [ ] Escapado de comillas/saltos de línea
- [ ] BOM UTF-8 + filename con fecha
- [ ] `pnpm build` pasa

### Phase 2
- [ ] `exportHref` respeta los filtros activos
- [ ] Dos botones visibles en el header del listado

### Phase 3
- [ ] `pnpm typecheck && pnpm lint && pnpm build` ✅
- [ ] Commit `feat: CSV export of inventory (task 011)`
- [ ] 401 sin sesión verificado

---

## Do NOT Do

- Do NOT tocar `prisma/schema.prisma` ni generar migraciones
- Do NOT instalar librerías de hojas de cálculo ni generar XLSX/PDF
- Do NOT exportar otros recursos (contactos, citas, alianzas, reportes)
- Do NOT enviar el CSV por correo ni programar envíos
- Do NOT modificar el importador ni la plantilla de la tarea 007
- Do NOT exponer este endpoint sin sesión ni con tokens públicos
- Do NOT paginar el CSV en múltiples descargas (el tope de 5,000 filas basta)
