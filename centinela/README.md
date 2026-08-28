# Centinela

Centinela es una plataforma interna de inteligencia comercial y captación inmobiliaria orientada a detectar propiedades antes que la competencia y convertir la prospección en un pipeline medible. El proyecto sigue el roadmap definido en [.tasks/CONTEXT.md](.tasks/CONTEXT.md) y está pensado para crecer desde un scaffolding sólido.

## Requisitos

- Node 22
- pnpm
- Docker (para la base de datos local)

## Desarrollo local

1. Levanta la base de datos:
   ```bash
   docker compose up -d
   ```
2. Ejecuta Prisma migrations:
   ```bash
   pnpm dlx prisma migrate dev --name init
   ```
3. Inicia la app:
   ```bash
   pnpm dev
   ```

## Scripts

| Script | Propósito |
| --- | --- |
| `pnpm dev` | Inicia el servidor de desarrollo |
| `pnpm build` | Genera la build de producción |
| `pnpm lint` | Ejecuta ESLint |
| `pnpm typecheck` | Ejecuta TypeScript sin emitir |
| `pnpm format` | Formatea el proyecto con Prettier |
| `pnpm set-password` | Asigna contraseñas de usuarios desde la terminal |

## Autenticación

Antes de usar la aplicación, asegúrate de tener una base de datos en ejecución:

```bash
docker compose up -d
```

Luego, ejecuta las migraciones y establece una contraseña para el usuario admin:

```bash
pnpm exec prisma migrate dev --name init
pnpm set-password admin@centinela.local <tu-contraseña>
```

Ahora puedes iniciar el servidor y acceder a http://localhost:3000/login con las credenciales:
- Correo: admin@centinela.local
- Contraseña: la que acabas de establecer
