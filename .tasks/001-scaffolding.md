# Task 001: Scaffolding del proyecto Centinela

## LLM Agent Directives

You are scaffolding the **Centinela** web application to achieve a production-grade
starting point where every future task (002+) is pure feature work.

Lee primero `.tasks/CONTEXT.md` — contiene stack, convenciones y dominio.
El repositorio vivirá en `centinela/` dentro del workspace (`/home/user/centinela`).

**Goals:**
1. Proyecto Next.js 15 (App Router) + TypeScript estricto + Tailwind, corriendo con pnpm
2. Prisma + PostgreSQL cableado (docker compose + schema inicial válido)
3. shadcn/ui instalado con shell de navegación en español y páginas placeholder
4. Quality gates funcionando: `pnpm typecheck`, `pnpm lint`, `pnpm build`
5. Documentación mínima: README.md y `.env.example`

**Rules:**
- DO NOT agregar funcionalidad de dominio (CRUDs, auth, dashboard) — eso son tareas 002+
- DO NOT crear modelos en el schema de Prisma más allá del datasource (tarea 002)
- DO NOT refactorizar código no relacionado
- DO NOT cambiar el stack ni versiones mayores (nada de Next 16, nada de npm/yarn)
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio
- Si falta pnpm en el entorno: `corepack enable` o `npm i -g pnpm`

Nota: si pnpm no está disponible en la máquina del colaborador sugiera correr:

```
corepack enable
```

También asegúrate de que `centinela/.env.example` incluya placeholders para
`DATABASE_URL`, `AUTH_SECRET` y `INGEST_TOKEN` (usado por la tarea de ingestión).

---

## Phase 1: Crear el proyecto Next.js

### 1.1 Scaffold con create-next-app

- [x] Proyecto creado en `centinela/`
- [x] `pnpm build` verificado en la app inicial

**Directorio:** workspace root (`/home/user`)

RUN:
```bash
pnpm dlx create-next-app@15 centinela --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack --yes
cd centinela
pnpm build
```

VERIFY: `pnpm build` termina sin errores y existe `centinela/package.json`.

---

## Phase 2: Quality gates

- [x] TypeScript estricto configurado
- [x] Prettier agregado y configurado
- [x] Scripts de quality gates definidos

### 2.1 Confirmar TypeScript estricto

**File:** `centinela/tsconfig.json`

VERIFY que `"strict": true` existe en `compilerOptions`. Si no está, agrégalo.

### 2.2 Prettier

RUN:
```bash
pnpm add -D prettier
```

**File:** `centinela/.prettierrc` (CREATE)
```json
{ "semi": true, "singleQuote": false, "printWidth": 100, "trailingComma": "all" }
```

**File:** `centinela/.prettierignore` (CREATE)
```
node_modules
.next
pnpm-lock.yaml
```

### 2.3 Scripts

**File:** `centinela/package.json`

FIND (los scripts pueden variar ligeramente; localiza el bloque `"scripts"`):
```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```

CHANGE TO (conserva los existentes y agrega `typecheck`, `format`, `format:check`):
```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

VERIFY: `pnpm typecheck && pnpm lint` pasan.

---

## Phase 3: Base de datos (Prisma + PostgreSQL)

- [x] Prisma instalado e inicializado
- [x] Schema de datasource ajustado para PostgreSQL
- [x] Docker compose creado para Postgres

### 3.1 Instalar e inicializar Prisma

RUN:
```bash
pnpm add -D prisma
pnpm add @prisma/client
pnpm dlx prisma init
```

### 3.2 Schema inicial

**File:** `centinela/prisma/schema.prisma`

El `prisma init` genera el archivo. VERIFY que el datasource sea `postgresql`; si
aparece otro provider, cámbialo:

CHANGE TO (solo el datasource si difiere):
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

DO NOT agregar modelos todavía — la tarea 002 define el dominio.

### 3.3 Docker compose para Postgres

**File:** `centinela/docker-compose.yml` (CREATE)
```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: centinela
      POSTGRES_PASSWORD: centinela_dev
      POSTGRES_DB: centinela
    ports:
      - "5432:5432"
    volumes:
      - centinela_pgdata:/var/lib/postgresql/data

volumes:
  centinela_pgdata:
```

**File:** `centinela/.env`

FIND:
```
DATABASE_URL="postgresql://..."
```
CHANGE TO:
```
DATABASE_URL="postgresql://centinela:centinela_dev@localhost:5432/centinela?schema=public"
```
(Nota: si el puerto 5432 está ocupado, cambia el puerto en compose y aquí, en ambos lados.)

VERIFY: `pnpm dlx prisma validate` pasa. Si hay docker disponible, además:
`docker compose up -d && pnpm dlx prisma migrate dev --name init && docker compose down`.
Si docker NO está disponible, déjalo anotado en el resumen final — el validate basta.

---

## Phase 4: shadcn/ui + shell en español

- [x] shadcn/ui inicializado con configuración base
- [x] Shell de navegación en español creado
- [x] Páginas placeholder creadas para los módulos

### 4.1 Inicializar shadcn

RUN:
```bash
pnpm dlx shadcn@latest init --yes --base-color neutral
pnpm dlx shadcn@latest add button card input label select badge table tabs dialog dropdown-menu separator sheet
```

### 4.2 Layout raíz en español

**File:** `centinela/src/app/layout.tsx`

FIND:
```tsx
<html lang="en">
```
CHANGE TO:
```tsx
<html lang="es">
```

FIND:
```tsx
export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};
```
CHANGE TO:
```tsx
export const metadata: Metadata = {
  title: "Centinela — Inteligencia de captación inmobiliaria",
  description:
    "Plataforma interna de inteligencia comercial para captar propiedades antes que la competencia.",
};
```

### 4.3 Shell de navegación

**File:** `centinela/src/components/app-shell.tsx` (CREATE)

Componente cliente simple: barra lateral (o header) con enlaces a:
Dashboard (`/`), Oportunidades (`/oportunidades`), Contactos (`/contactos`),
Citas (`/citas`), Alianzas (`/alianzas`), Reportes (`/reportes`).
Usa componentes shadcn ya instalados. Máximo ~60 líneas — nada de lógica.

Envuelve el `{children}` de `src/app/layout.tsx` con `<AppShell>`.

### 4.4 Páginas placeholder

**File:** `centinela/src/app/page.tsx` (REPLACE)

Landing simple: título "Centinela", una línea describiendo la plataforma
y tarjetas estáticas con los 5 KPIs del CONTEXT.md (solo texto, sin datos reales).

**Files:** CREATE una `page.tsx` en cada una de estas rutas:
`src/app/oportunidades/`, `src/app/contactos/`, `src/app/citas/`,
`src/app/alianzas/`, `src/app/reportes/`

Cada página: título del módulo + texto
"Módulo pendiente — ver roadmap en .tasks/CONTEXT.md".

VERIFY: `pnpm build` pasa y `ls src/app` muestra los 6 directorios de rutas.

---

## Phase 5: Documentación y entorno

- [x] Archivo .env.example creado
- [x] README en español actualizado
- [x] Entorno y documentación listos para seguir con la próxima tarea

### 5.1 .env.example

**File:** `centinela/.env.example` (CREATE)
```
DATABASE_URL="postgresql://centinela:centinela_dev@localhost:5432/centinela?schema=public"
```

VERIFY: `grep -E "^\.env" .gitignore` confirma que `.env` NO se commitea
(create-next-app lo trae por defecto; si falta, agrega `.env` y `.env.local`).

### 5.2 README

**File:** `centinela/README.md` (REPLACE)

En español: qué es Centinela (2 párrafos, referencia a `.tasks/CONTEXT.md`),
requisitos (Node 22, pnpm, Docker), pasos para correr
(`docker compose up -d`, `pnpm dlx prisma migrate dev`, `pnpm dev`),
y tabla de scripts (`dev`, `build`, `lint`, `typecheck`, `format`).

### 5.3 Commit

RUN:
```bash
git add -A && git commit -m "chore: scaffolding Centinela (task 001)"
```

---

## Phase 6: Verify final

RUN estos comandos (desde `centinela/`):
```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm dev &  # arrancar, probar y detener
curl -sf http://localhost:3000 > /dev/null && echo OK
```

VERIFY: los 4 pasan; el home responde 200 y las rutas placeholder existen.

---

## Checklist

### Phase 1
- [ ] `centinela/` creado con Next 15 + TS + Tailwind + pnpm
- [ ] `pnpm build` baseline pasa

### Phase 2
- [ ] `tsconfig.json` en strict
- [ ] Prettier instalado y configurado
- [ ] Scripts `typecheck`, `format`, `format:check` agregados
- [ ] `pnpm typecheck && pnpm lint` pasan

### Phase 3
- [ ] Prisma inicializado con provider `postgresql`
- [ ] `docker-compose.yml` creado
- [ ] `.env` con DATABASE_URL correcto
- [ ] `prisma validate` pasa

### Phase 4
- [ ] shadcn/ui inicializado + componentes base agregados
- [ ] `layout.tsx` con `lang="es"` y metadata en español
- [ ] `AppShell` con navegación a 6 rutas
- [ ] 5 páginas placeholder creadas
- [ ] `pnpm build` pasa

### Phase 5
- [ ] `.env.example` creado; `.env` fuera de git
- [ ] README.md en español
- [ ] Commit hecho

### Phase 6
- [ ] `pnpm typecheck && pnpm lint && pnpm build` ✅
- [ ] Dev server responde 200

---

## Do NOT Do

- Do NOT crear modelos de dominio en Prisma (es la tarea 002)
- Do NOT implementar autenticación (es la tarea 003)
- Do NOT construir CRUDs, dashboards con datos reales ni formularios
- Do NOT agregar scrapers, crawlers ni integraciones con redes/portales
- Do NOT agregar CI/CD, tests E2E ni dependencias fuera de las listadas
- Do NOT cambiar la estructura `src/app`, `src/components`, `src/lib` ni el alias `@/*`
- Do NOT subir a Next 16 ni cambiar pnpm por otro package manager
