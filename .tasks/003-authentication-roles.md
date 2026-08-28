# Task 003: Autenticación y roles

## LLM Agent Directives

You are implementing **authentication and role-based access control** for Centinela
to achieve a secure internal tool where every route requires login and admin
screens require the ADMIN role.

Lee primero `.tasks/CONTEXT.md`. El proyecto existe en `centinela/` con las tareas
001 (scaffold) y 002 (schema + seed con usuario `admin@centinela.local` sin password).
Trabaja siempre desde `centinela/`.

**Goals:**
1. Login con credenciales (Auth.js v5 + bcryptjs contra `User.passwordHash`)
2. Protección de rutas: nada accesible sin sesión; `/admin/*` solo para ADMIN
3. UI de login en español y cierre de sesión desde el shell
4. Pantalla `/admin/usuarios` (solo ADMIN): listar y crear usuarios con rol
5. Script `set-password` para asignar contraseñas desde terminal
6. Quality gates verdes al final

**Rules:**
- DO NOT modificar `prisma/schema.prisma` ni crear migraciones — el schema ya tiene todo
- DO NOT crear registro público, OAuth, magic links, "olvidé mi contraseña" ni 2FA
- DO NOT construir módulos de dominio (oportunidades, contactos…) — eso es 004+
- DO NOT usar SessionProvider/useSession — la sesión se lee server-side
- RUN `pnpm typecheck` después de cada fase
- VERIFY que ningún import se rompa tras cada cambio

---

## Phase 1: Dependencias, entorno y cliente Prisma

### 1.1 Instalar

RUN:
```bash
pnpm add next-auth@beta bcryptjs zod
pnpm add -D @types/bcryptjs
```
(Nota: si next-auth v5 estable ya está publicado, usa `pnpm add next-auth@5`.)

### 1.2 Variables de entorno

Genera un secreto y agréalo a `.env` y `.env.example`:

RUN: `openssl rand -base64 32`

**File:** `centinela/.env` (AGREGAR)
```
AUTH_SECRET="<pega aquí el valor generado>"
AUTH_TRUST_HOST=true
```

**File:** `centinela/.env.example` (AGREGAR)
```
AUTH_SECRET="genera uno con: openssl rand -base64 32"
AUTH_TRUST_HOST=true
```

Nota: asegúrate de que `AUTH_SECRET` esté presente en `.env.example` para que los colaboradores sepan generar y configurar el secreto localmente.

### 1.3 Singleton de Prisma

**File:** `centinela/src/lib/prisma.ts` (CREATE)
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 2: Núcleo de Auth.js

### 2.1 Config segura para Edge

**File:** `centinela/src/auth.config.ts` (CREATE)
```typescript
import type { NextAuthConfig } from "next-auth";

// Sin imports de Prisma ni bcrypt: este archivo lo consume el middleware (Edge).
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
} satisfies NextAuthConfig;
```

### 2.2 Config completa

**File:** `centinela/src/auth.ts` (CREATE)
```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user?.passwordHash || !user.isActive) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && token.role) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
```

### 2.3 Types de sesión

**File:** `centinela/src/types/next-auth.d.ts` (CREATE)
```typescript
import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}
```

### 2.4 Route handler

**File:** `centinela/src/app/api/auth/[...nextauth]/route.ts` (CREATE)
```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

VERIFY: `pnpm typecheck` pasa.

---

## Phase 3: Reorganizar rutas en grupos `(app)` y `(auth)`

### 3.1 Mover páginas al grupo protegido

RUN:
```bash
mkdir -p "src/app/(app)" "src/app/(auth)/login"
git mv src/app/page.tsx "src/app/(app)/page.tsx"
git mv src/app/oportunidades "src/app/(app)/oportunidades"
git mv src/app/contactos "src/app/(app)/contactos"
git mv src/app/citas "src/app/(app)/citas"
git mv src/app/alianzas "src/app/(app)/alianzas"
git mv src/app/reportes "src/app/(app)/reportes"
```

Las rutas públicas NO cambian (`/`, `/oportunidades`, …).

### 3.2 Layout raíz sin shell

**File:** `centinela/src/app/layout.tsx`

Quita el uso de `AppShell` del body (se moverá al layout del grupo). El body queda:
```tsx
<body className={...}>{children}</body>
```
(conserva las clases existentes).

### 3.3 Layout del grupo `(app)` con sesión

**File:** `centinela/src/app/(app)/layout.tsx` (CREATE)
```tsx
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const user = session?.user
    ? {
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        role: session.user.role,
      }
    : null;

  return <AppShell user={user}>{children}</AppShell>;
}
```

Ajusta la exportación/props de `AppShell` según cómo haya quedado en la tarea 001
(nombre de export, default vs named): el contrato es que reciba un prop
`user: { name: string; email: string; role: string } | null`.

VERIFY: `pnpm typecheck && pnpm build` pasan; las rutas siguen siendo las mismas.

---

## Phase 4: Middleware y guards

### 4.1 Middleware

**File:** `centinela/src/middleware.ts` (CREATE)
```typescript
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname.startsWith("/login");
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

  if (isAuthApi) return NextResponse.next();

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }
  if (isAdminRoute && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
```

### 4.2 Guards para server components/actions

**File:** `centinela/src/lib/guards.ts` (CREATE)
```typescript
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 5: Login en español

### 5.1 Página (server) + formulario (client)

**File:** `centinela/src/app/(auth)/login/page.tsx` (CREATE)
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");
  return <LoginForm />;
}
```

**File:** `centinela/src/app/(auth)/login/login-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, { error: null as string | null });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Centinela</CardTitle>
          <CardDescription>Inicia sesión para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" name="email" type="email" required placeholder="tu@correo.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" required minLength={8} />
            </div>
            {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Iniciando sesión…" : "Iniciar sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 5.2 Server action

**File:** `centinela/src/app/(auth)/login/actions.ts` (CREATE)
```typescript
"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";

const schema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function loginAction(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Credenciales inválidas. Verifica tu correo y contraseña." };
    }
    throw error;
  }
  return { error: null };
}
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 6: Sesión y cierre de sesión en el shell

### 6.1 Acción de cierre de sesión

**File:** `centinela/src/app/actions.ts` (CREATE)
```typescript
"use server";

import { signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
```

### 6.2 Botón de cerrar sesión

**File:** `centinela/src/components/sign-out-button.tsx` (CREATE)
```tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {pending ? "Cerrando…" : "Cerrar sesión"}
    </Button>
  );
}
```

### 6.3 Actualizar AppShell

**File:** `centinela/src/components/app-shell.tsx` (MODIFY)

- Recibe el prop `user: { name: string; email: string; role: string } | null`
- Al final de la navegación muestra: nombre del usuario, su rol en un `Badge` y `<SignOutButton />`
- Agrega el enlace **"Usuarios"** hacia `/admin/usuarios`, renderizado solo si
  `user?.role === "ADMIN"`
- Conserva los enlaces existentes sin cambios

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 7: Administración de usuarios (solo ADMIN)

### 7.1 Página de listado

**File:** `centinela/src/app/(app)/admin/usuarios/page.tsx` (CREATE)
```tsx
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreateUserForm } from "./create-user-form";

export default async function UsuariosPage() {
  await requireRole("ADMIN");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Administra el acceso del equipo. Solo visible para administradores.
        </p>
      </div>
      <CreateUserForm />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estatus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Badge variant="secondary">{u.role}</Badge>
              </TableCell>
              <TableCell>{u.isActive ? "Activo" : "Inactivo"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### 7.2 Formulario de creación (client)

**File:** `centinela/src/app/(app)/admin/usuarios/create-user-form.tsx` (CREATE)
```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createUserAction } from "./actions";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, {
    error: null as string | null,
    success: null as string | null,
  });

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4 md:grid-cols-5">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <div className="space-y-2">
        <Label>Rol</Label>
        <Select name="role" defaultValue="ANALYST" required>
          <SelectTrigger>
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANALYST">Analista</SelectItem>
            <SelectItem value="ADVISOR">Asesor</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creando…" : "Crear usuario"}
        </Button>
      </div>
      {state?.error ? (
        <p className="text-sm text-destructive md:col-span-5">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="text-sm text-green-600 md:col-span-5">{state.success}</p>
      ) : null}
    </form>
  );
}
```

### 7.3 Server action de creación

**File:** `centinela/src/app/(app)/admin/usuarios/actions.ts` (CREATE)
```typescript
"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.nativeEnum(Role),
});

export async function createUserAction(
  _prev: { error: string | null; success: string | null },
  formData: FormData,
): Promise<{ error: string | null; success: string | null }> {
  await requireRole("ADMIN");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", success: null };
  }
  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return { error: "Ya existe un usuario con ese correo.", success: null };
  }

  await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      role,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  revalidatePath("/admin/usuarios");
  return { error: null, success: `Usuario ${name} creado correctamente.` };
}
```

VERIFY: `pnpm typecheck && pnpm build` pasan.

---

## Phase 8: Script de contraseñas, README y commit

### 8.1 Script set-password

**File:** `centinela/scripts/set-password.ts` (CREATE)
```typescript
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Uso: pnpm set-password <email> <password>");
  process.exit(1);
}

const prisma = new PrismaClient();
const hash = bcrypt.hashSync(password, 12);

const user = await prisma.user.update({
  where: { email },
  data: { passwordHash: hash },
});

console.log(`✅ Contraseña actualizada para ${user.email}`);
await prisma.$disconnect();
```

**File:** `centinela/package.json`

Agregar al bloque `"scripts"`:
```json
"set-password": "tsx scripts/set-password.ts"
```

### 8.2 README

**File:** `centinela/README.md` (AGREGAR sección "Autenticación")

Explicar en español: generar `AUTH_SECRET`, levantar BD, correr
`pnpm set-password admin@centinela.local <contraseña>` y entrar en `/login`.

### 8.3 Gates y commit

RUN:
```bash
pnpm typecheck
pnpm lint
pnpm build
git add -A && git commit -m "feat: authentication, roles and admin users (task 003)"
```

---

## Phase 9: Verify final

RUN:
```bash
docker compose up -d
pnpm set-password admin@centinela.local "CambiarEsta123!"
pnpm dev &
sleep 8
curl -sI http://localhost:3000/oportunidades | head -5   # espera un 3xx hacia /login
curl -sI http://localhost:3000/login | head -5            # espera 200
```

VERIFY:
- Sin sesión: las rutas protegidas redirigen a `/login`
- `/login` responde 200
- Si tienes navegador disponible: entra con `admin@centinela.local` y la contraseña
  asignada, confirma que ves el shell con tu nombre y rol, y que "Cerrar sesión" funciona
- `pnpm typecheck && pnpm lint && pnpm build` siguen pasando
- Anota en el resumen final cualquier verificación manual que no pudiste ejecutar

---

## Checklist

### Phase 1
- [ ] next-auth v5, bcryptjs, zod instalados
- [ ] `AUTH_SECRET` y `AUTH_TRUST_HOST` en `.env` y `.env.example`
- [ ] `src/lib/prisma.ts` creado

### Phase 2
- [ ] `auth.config.ts`, `auth.ts`, types y route handler creados
- [ ] `pnpm typecheck` pasa

### Phase 3
- [ ] Páginas movidas a `(app)`; login en `(auth)`
- [ ] Layout raíz sin shell; `(app)/layout.tsx` con sesión
- [ ] `pnpm build` pasa

### Phase 4
- [ ] Middleware protege rutas y `/admin`
- [ ] `requireUser` / `requireRole` en `src/lib/guards.ts`

### Phase 5
- [ ] Login en español con server action y mensajes de error

### Phase 6
- [ ] AppShell muestra usuario + rol + "Cerrar sesión"
- [ ] Enlace "Usuarios" visible solo para ADMIN

### Phase 7
- [ ] `/admin/usuarios` lista y crea usuarios (solo ADMIN)

### Phase 8
- [ ] `pnpm set-password` funciona
- [ ] README actualizado
- [ ] Commit `feat: authentication, roles and admin users (task 003)`

### Phase 9
- [ ] Redirects verificados con curl
- [ ] Gates verdes al final

---

## Do NOT Do

- Do NOT tocar `prisma/schema.prisma` ni generar migraciones
- Do NOT crear registro público u olvidé-mi-contraseña
- Do NOT agregar proveedores OAuth (Google, GitHub…)
- Do NOT usar SessionProvider/useSession
- Do NOT construir funcionalidad de oportunidades, contactos, citas, alianzas o reportes
- Do NOT hardcodear credenciales ni secretos en el código
- Do NOT cambiar las rutas públicas existentes (`/`, `/oportunidades`, …)
