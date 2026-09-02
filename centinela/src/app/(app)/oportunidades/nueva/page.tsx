import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { NewOpportunityForm } from "./new-opportunity-form";

export default async function NewOpportunityPage() {
  await requireUser();
  const [sources, contacts] = await Promise.all([
    prisma.source.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.contact.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/oportunidades"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Nueva oportunidad</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra una propiedad detectada. Entra al pipeline con estatus “Registrada”.
        </p>
      </div>
      <NewOpportunityForm sources={sources} contacts={contacts} />
    </div>
  );
}
