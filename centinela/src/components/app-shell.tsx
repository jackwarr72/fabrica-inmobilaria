"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BriefcaseBusiness, ContactRound, CalendarDays, Handshake, FileText, Users } from "lucide-react";
import { SignOutButton } from "./sign-out-button";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/oportunidades", label: "Oportunidades", icon: BriefcaseBusiness },
  { href: "/contactos", label: "Contactos", icon: ContactRound },
  { href: "/citas", label: "Citas", icon: CalendarDays },
  { href: "/alianzas", label: "Alianzas", icon: Handshake },
  { href: "/reportes", label: "Reportes", icon: FileText },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: { name: string; email: string; role: string } | null }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-200 bg-white p-6">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Centinela</p>
          <h2 className="mt-2 text-xl font-semibold">Panel operativo</h2>
        </div>
        <nav className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin/usuarios"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <Users className="h-4 w-4" />
              Usuarios
            </Link>
          )}
        </nav>
        {user && (
          <div className="absolute bottom-6 left-6 right-6">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <p className="font-medium">{user.name}</p>
              <p className="text-slate-600">{user.email}</p>
              <p className="mt-1 text-xs text-slate-500">{user.role}</p>
            </div>
            <div className="mt-3">
              <SignOutButton />
            </div>
          </div>
        )}
      </aside>

      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
