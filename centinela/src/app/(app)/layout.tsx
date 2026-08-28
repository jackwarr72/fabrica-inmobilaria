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
