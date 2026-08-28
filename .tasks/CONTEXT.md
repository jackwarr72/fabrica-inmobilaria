# CONTEXT.md — Centinela (nombre de trabajo)

> Contexto obligatorio para todo agente que ejecute tareas de `.tasks/`.
> Última actualización: 2026-08-05 · Estado: greenfield, pre-MVP.

## 1. Visión del proyecto

Plataforma web interna de inteligencia comercial y captación inmobiliaria.
Objetivo: detectar propiedades (venta, renta, terrenos, locales, bodegas,
desarrollos, oportunidades de inversión) ANTES que la competencia,
centralizar la prospección y convertirla en un pipeline medible que alimente
el inventario y la captación de exclusivas.

## 2. Usuarios y roles

| Rol | Qué hace en sistema |
|---|---|
| Analista | Busca, registra, valida y califica oportunidades |
| Asesor | Contacta, agenda citas, da seguimiento, cierra exclusivas |
| Admin | Configura fuentes, usuarios y metas de KPIs |

UI en español (es-MX). Código e identificadores en inglés.

## 3. KPIs (el sistema DEBE poder medirlos)

| KPI | Meta |
|---|---|
| Propiedades nuevas captadas | ≥ 20 / día |
| Contactos nuevos | ≥ 50 / semana |
| Tasa de calificación | ≥ 30% propiedades calificadas |
| Citas agendadas | ≥ 10 / semana |
| Tiempo a primer contacto | < 24 horas |

## 4. Flujo operativo (pipeline)

Buscar → Registrar → Validar → Calificar → Contactar → Cita →
Documentación → Inventario → Seguimiento

- Modelado como enum de estatus + historial de transiciones (timestamp y usuario).
- Calificación de oportunidades: ALTA / MEDIA / BAJA según precio, motivación
  del propietario y documentación disponible.

## 5. Stack y convenciones

- Next.js 15 (App Router) · TypeScript estricto · Node 22 + pnpm
- Tailwind CSS + shadcn/ui
- PostgreSQL + Prisma (dev: docker compose)
- Validación: Zod (schemas compartidos cliente/servidor)
- Calidad: ESLint + Prettier + `pnpm typecheck`
- Estructura: `src/app`, `src/components`, `src/lib`, `src/server`, `prisma/`

## 6. Dominio (entidades clave)

- `User` (rol: admin/analista/asesor)
- `Opportunity` (inmueble detectado: tipo, operación, precio, zona, fuente, estatus, calificación)
- `Contact` (propietario/broker/aliado, con datos y último contacto)
- `StageHistory` (transiciones del pipeline)
- `Appointment` (citas)
- `PriceEvent` (cambios de precio detectados)
- `Alliance` (brokers, desarrolladores, notarios, arquitectos, abogados, valuadores + interacciones)
- `DailyReport` (entregables: propiedades detectadas, contactos, cambios de precio, citas, inventario)

## 7. Estrategia de ingestión (por fases)

1. MVP: captura manual + importación CSV
2. Parseo de alertas (Google Alerts por email, RSS)
3. Webhooks/API desde Make, Zapier, Distill.io
4. Conectores a portales (solo si existe API o acuerdo)

REGLA: no hacer scraping directo de redes sociales ni portales.

## 8. Non-goals (MVP)

- Scrapers propios de Facebook/Instagram/TikTok/portales
- Módulo de ventas/cobranza, marketing o facturación
- App móvil nativa

## 9. Definition of Done (toda tarea)

- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm build` ✅
- Sin imports rotos · Sin features fuera del spec de la tarea

## 10. Roadmap tentativo de tareas

- 001: Scaffolding del proyecto (Next.js + Tailwind + Prisma + shadcn + quality gates)
- 002: Esquema de BD (Prisma) según sección 6
- 003: Autenticación y roles
- 004: CRUD de oportunidades + pipeline de estatus
- 005: Contactos y agenda de citas
- 006: Dashboard de KPIs + entregables diarios
- 007: Importación CSV / ingestión de alertas
- 008: Tracker de alianzas estratégicas

## 11. Required env vars & Run locally

- **Required env vars (examples):** `DATABASE_URL`, `AUTH_SECRET`, `INGEST_TOKEN` (used by the ingestion webhook). See individual task specs for additional vars.
- **Run locally:** follow the quick start in [centinela/README.md](centinela/README.md) to start the database and dev server.
