<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository guidance

## Choose the correct application boundary

- The primary product is the authenticated Next.js app under [centinela/](centinela/README.md); run its commands from that directory.
- The root Next.js project, [agents/](agents/), and [scraper/](scraper/) are separate stacks with different runtimes and data models.
- Treat [centinela/prisma/schema.prisma](centinela/prisma/schema.prisma) and [prisma/schema.prisma](prisma/schema.prisma) as independent schemas unless consolidation is explicitly requested.
- Root Docker Compose and [centinela/docker-compose.yml](centinela/docker-compose.yml) both claim host port `5432`; run only the intended database stack or change the port deliberately.

## Before editing

- For Next.js changes, read the relevant guide under `node_modules/next/dist/docs/` for the target app and preserve its existing conventions.
- Read [\.tasks/CONTEXT.md](.tasks/CONTEXT.md) and the relevant task spec when implementing roadmap work; do not start unrelated tasks.
- Inspect nearby route, component, action, and schema examples before adding new patterns.

## Active app conventions

- In `centinela/`, use the `@/` alias, strict TypeScript, App Router route groups, Tailwind/shadcn UI, and Spanish (`es-MX`) user-facing text with English identifiers.
- Use the shared Prisma client in `centinela/src/lib/prisma.ts` and authorization helpers in `centinela/src/lib/guards.ts`; do not duplicate session or role checks.
- Keep server actions marked with `"use server"` and client components marked with `"use client"` where required by the existing code.
- Validate changes from `centinela/` with `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and `pnpm build`.

## Python and scraper boundaries

- `agents/` is a FastAPI/SQLAlchemy service backed by the root PostgreSQL conventions; `scraper/` is a Scrapy + SQLite pipeline.
- Run scraper commands from `scraper/` because `properties.db` is relative to the working directory.
- Preserve scraper politeness settings and source configuration in [scraper/sources.json](scraper/sources.json); do not add direct social-media or portal scraping contrary to the project roadmap.

## Safety and scope

- Do not casually modify generated files, migrations, local databases, logs, caches, or unrelated stacks.
- Never commit credentials; use environment variables and existing local-development placeholders only where the project already expects them.
- Keep changes limited to the requested task and report verification failures with the exact command and output.
