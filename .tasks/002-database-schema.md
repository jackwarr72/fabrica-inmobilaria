# Task 002: Esquema de base de datos (dominio Centinela)

## LLM Agent Directives

You are implementing the **complete Prisma domain schema** for Centinela to achieve
a fully migrated database that tasks 003+ (auth, CRUDs, dashboard) will build upon.

Lee primero `.tasks/CONTEXT.md` (secciones 3, 4 y 6). El proyecto ya existe en
`centinela/` (scaffolding de la tarea 001). Trabaja siempre desde `centinela/`.

**Goals:**
1. Reemplazar el schema de Prisma con los 9 modelos + 9 enums del dominio
2. Generar y aplicar la migración contra PostgreSQL (docker compose de la tarea 001)
3. Seed mínimo: 1 usuario admin + fuentes de captación base
4. Todo debe pasar los quality gates sin tocar el resto del scaffold

**Rules:**
- DO NOT crear API routes, UI ni lógica de negocio — solo schema + migración + seed
- DO NOT agregar modelos o campos que no estén en este spec
- DO NOT modificar archivos del scaffold salvo `package.json` (bloque `prisma.seed`) y `prisma/schema.prisma`
- DO NOT tocar autenticación (tarea 003)
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio

---

## Phase 1: Esquema completo

- [x] Schema de Prisma reemplazado con los modelos y enums del dominio
- [x] Seed mínimo agregado para usuario admin y fuentes base
- [x] Quality gates del scaffold verificados

### 1.1 Reemplazar schema.prisma

**File:** `centinela/prisma/schema.prisma`

Actualmente contiene solo `generator` + `datasource`. REPLACE todo el contenido por:

```prisma
// Centinela — dominio de captación inmobiliaria (Task 002)
// Referencia: .tasks/CONTEXT.md secciones 3, 4 y 6.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────

enum Role {
  ADMIN
  ANALYST
  ADVISOR
}

enum PropertyType {
  HOUSE        // casa
  APARTMENT    // departamento
  LAND         // terreno
  COMMERCIAL   // local comercial
  WAREHOUSE    // bodega
  DEVELOPMENT  // desarrollo
  INVESTMENT   // oportunidad de inversión
  OTHER
}

enum OperationType {
  SALE  // venta
  RENT  // renta
}

enum OpportunityStatus {
  DETECTED       // buscar
  REGISTERED     // registrar
  VALIDATING     // validar
  QUALIFIED      // calificar
  CONTACTED      // contactar
  APPOINTMENT    // cita
  DOCUMENTATION  // documentación
  INVENTORY      // inventario
  FOLLOW_UP      // seguimiento
  DISCARDED      // descartada
}

enum Qualification {
  HIGH    // alta
  MEDIUM  // media
  LOW     // baja
}

enum ContactKind {
  OWNER
  BROKER
  ALLIANCE
  OTHER
}

enum SourceKind {
  SOCIAL_MEDIA
  PORTAL
  FORUM
  GOOGLE_ALERT
  ALLIANCE
  REFERRAL
  MANUAL
  OTHER
}

enum AllianceType {
  BROKER
  DEVELOPER
  NOTARY
  ARCHITECT
  LAWYER
  APPRAISER
  OTHER
}

enum AppointmentStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
  NO_SHOW
}

// ─── Usuarios ─────────────────────────────────────────────

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String?  // null hasta que la tarea 003 implemente auth
  role         Role     @default(ANALYST)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  registeredOps        Opportunity[]         @relation("RegisteredBy")
  assignedOps          Opportunity[]         @relation("AssignedOps")
  assignedContacts     Contact[]
  appointments         Appointment[]
  stageHistory         StageHistory[]
  allianceInteractions AllianceInteraction[]
  dailyReports         DailyReport[]
}

// ─── Captación ────────────────────────────────────────────

model Source {
  id        String     @id @default(cuid())
  name      String     @unique
  kind      SourceKind
  url       String?
  notes     String?
  isActive  Boolean    @default(true)
  createdAt DateTime   @default(now())

  opportunities Opportunity[]
}

model Opportunity {
  id                 String            @id @default(cuid())
  title              String
  description        String?
  propertyType       PropertyType
  operation          OperationType
  price              Decimal?          @db.Decimal(14, 2)
  currency           String            @default("MXN")
  zone               String?           // zona / colonia / municipio
  address            String?
  sourceUrl          String?           // liga de la publicación original
  sourceNotes        String?           // cómo se detectó (operadores de búsqueda, alerta…)
  status             OpportunityStatus @default(DETECTED)
  qualification      Qualification?    // null hasta calificarse
  qualificationNotes String?
  firstContactAt     DateTime?         // KPI: contacto en < 24h
  sourceId           String?
  contactId          String?
  registeredById     String?
  assignedToId       String?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  source       Source?        @relation(fields: [sourceId], references: [id])
  contact      Contact?       @relation(fields: [contactId], references: [id])
  registeredBy User?          @relation("RegisteredBy", fields: [registeredById], references: [id])
  assignedTo   User?          @relation("AssignedOps", fields: [assignedToId], references: [id])
  stageHistory StageHistory[]
  priceEvents  PriceEvent[]
  appointments Appointment[]

  @@index([status, createdAt])
  @@index([sourceId])
  @@index([contactId])
  @@index([assignedToId])
}

model StageHistory {
  id            String             @id @default(cuid())
  opportunityId String
  fromStatus    OpportunityStatus?
  toStatus      OpportunityStatus
  note          String?
  userId        String?
  createdAt     DateTime           @default(now())

  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  user        User?       @relation(fields: [userId], references: [id])

  @@index([opportunityId, createdAt])
}

model PriceEvent {
  id            String   @id @default(cuid())
  opportunityId String
  oldPrice      Decimal? @db.Decimal(14, 2)
  newPrice      Decimal  @db.Decimal(14, 2)
  note          String?
  detectedAt    DateTime @default(now())

  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  @@index([opportunityId, detectedAt])
}

// ─── Contactos y citas ────────────────────────────────────

model Contact {
  id            String      @id @default(cuid())
  name          String
  kind          ContactKind @default(OWNER)
  phone         String?
  phone2        String?
  email         String?
  socialHandle  String?     // usuario de FB / IG / WhatsApp
  zone          String?
  notes         String?
  lastContactAt DateTime?
  assignedToId  String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  assignedTo    User?         @relation(fields: [assignedToId], references: [id])
  opportunities Opportunity[]
  appointments  Appointment[]

  @@index([createdAt])
  @@index([assignedToId])
}

model Appointment {
  id            String            @id @default(cuid())
  opportunityId String?
  contactId     String?
  userId        String?
  scheduledAt   DateTime
  locationOrUrl String?           // dirección física o liga de videollamada
  status        AppointmentStatus @default(SCHEDULED)
  notes         String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  opportunity Opportunity? @relation(fields: [opportunityId], references: [id])
  contact     Contact?     @relation(fields: [contactId], references: [id])
  user        User?        @relation(fields: [userId], references: [id])

  @@index([scheduledAt])
  @@index([userId])
}

// ─── Alianzas estratégicas ────────────────────────────────

model Alliance {
  id        String       @id @default(cuid())
  name      String
  type      AllianceType
  company   String?
  phone     String?
  email     String?
  zone      String?
  notes     String?
  isActive  Boolean      @default(true)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  interactions AllianceInteraction[]
}

model AllianceInteraction {
  id         String   @id @default(cuid())
  allianceId String
  userId     String?
  date       DateTime @default(now())
  channel    String?  // llamada, WhatsApp, presencial, email…
  notes      String?

  alliance Alliance @relation(fields: [allianceId], references: [id], onDelete: Cascade)
  user     User?    @relation(fields: [userId], references: [id])

  @@index([allianceId, date])
}

// ─── Entregables diarios ──────────────────────────────────

model DailyReport {
  id                    String   @id @default(cuid())
  date                  DateTime @unique @db.Date
  propertiesDetected    Int      @default(0)
  newContacts           Int      @default(0)
  priceChanges          Int      @default(0)
  appointmentsScheduled Int      @default(0)
  inventoryUpdated      Boolean  @default(false)
  notes                 String?
  createdById           String?
  createdAt             DateTime @default(now())

  createdBy User? @relation(fields: [createdById], references: [id])
}
```

VERIFY: `pnpm dlx prisma validate` pasa sin errores.

---

## Phase 2: Migración y cliente

### 2.1 Aplicar migración

RUN:
```bash
docker compose up -d
pnpm dlx prisma migrate dev --name domain_models
```

VERIFY: la salida indica que la migración se aplicó y el cliente fue generado.

FALLBACK si no hay docker en el entorno: ejecuta `pnpm dlx prisma validate && pnpm dlx prisma generate`
y anota en el resumen final que la migración quedó pendiente de aplicar.

---

## Phase 3: Seed mínimo

### 3.1 Dependencia

RUN: `pnpm add -D tsx`

### 3.2 Seed

**File:** `centinela/prisma/seed.ts` (CREATE)

```typescript
import { PrismaClient, Role, SourceKind } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCES = [
  { name: "Facebook Marketplace", kind: SourceKind.SOCIAL_MEDIA },
  { name: "Grupos de Facebook", kind: SourceKind.SOCIAL_MEDIA },
  { name: "Instagram", kind: SourceKind.SOCIAL_MEDIA },
  { name: "TikTok", kind: SourceKind.SOCIAL_MEDIA },
  { name: "LinkedIn", kind: SourceKind.SOCIAL_MEDIA },
  { name: "Google Alerts", kind: SourceKind.GOOGLE_ALERT },
  { name: "Referido directo", kind: SourceKind.REFERRAL },
] as const;

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@centinela.local" },
    update: {},
    create: { email: "admin@centinela.local", name: "Admin Centinela", role: Role.ADMIN },
  });

  for (const s of SOURCES) {
    await prisma.source.upsert({ where: { name: s.name }, update: {}, create: s });
  }

  console.log("Seed completado: 1 usuario admin + fuentes base.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Nota: el usuario `admin@centinela.local` creado por el seed no tendrá contraseña.
Usa `scripts/set-password.ts` (o el script especificado en `package.json`) para asignar una contraseña segura después de correr el seed en desarrollo.

### 3.3 Conectar el seed

**File:** `centinela/package.json`

Agregar este bloque de primer nivel (conserva todo lo existente):
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

RUN: `pnpm dlx prisma db seed`

VERIFY: la salida muestra "Seed completado: 1 usuario admin + fuentes base."

---

## Phase 4: Quality gates y commit

RUN:
```bash
pnpm typecheck
pnpm lint
pnpm build
git add -A && git commit -m "feat: domain schema, migration and seed (task 002)"
```

VERIFY: los tres comandos pasan y el commit se crea.

---

## Phase 5: Verify final

RUN:
```bash
pnpm dlx prisma migrate status
pnpm dlx prisma validate
pnpm typecheck && pnpm lint && pnpm build
```

VERIFY:
- `migrate status` reporta la base de datos en sincronía (si hay docker)
- No hay errores de TypeScript ni de lint
- El build de Next.js sigue pasando

---

## Checklist

### Phase 1
- [ ] `schema.prisma` reemplazado con 9 modelos + 9 enums
- [ ] `prisma validate` pasa

### Phase 2
- [ ] Migración `domain_models` aplicada (o anotado el fallback sin docker)
- [ ] Cliente Prisma generado

### Phase 3
- [ ] `tsx` instalado
- [ ] `prisma/seed.ts` creado
- [ ] Bloque `prisma.seed` en package.json
- [ ] `prisma db seed` corre sin errores

### Phase 4
- [ ] `pnpm typecheck` ✅
- [ ] `pnpm lint` ✅
- [ ] `pnpm build` ✅
- [ ] Commit `feat: domain schema, migration and seed (task 002)`

### Phase 5
- [ ] `prisma migrate status` en sincronía
- [ ] Gates verdes otra vez al final

---

## Do NOT Do

- Do NOT crear API routes, server actions ni componentes UI
- Do NOT implementar autenticación ni hash de passwords (tarea 003)
- Do NOT agregar modelos/campos/índices fuera de este spec
- Do NOT renombrar enums o modelos (los nombres son contrato para tareas 003+)
- Do NOT modificar el scaffold de la tarea 001 fuera de lo indicado
- Do NOT hacer seed con datos ficticios de propiedades o contactos
