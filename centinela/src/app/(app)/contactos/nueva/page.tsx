import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ContactForm } from "../contact-form";

export default async function NewContactPage() {
  const user = await requireUser();
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/contactos"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Nuevo contacto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra propietarios, brokers y aliados detectados en la prospección.
        </p>
      </div>
      <ContactForm users={users} currentUserId={user.id} />
    </div>
  );
}
