import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

import DashboardHome from "./(app)/page";

export default async function RootPage() {
  const session = await auth();
  const user = session?.user
    ? {
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        role: session.user.role,
      }
    : null;

  return (
    <AppShell user={user}>
      <DashboardHome />
    </AppShell>
  );
}
