import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { AppointmentForm } from "./appointment-form";

export default async function NewAppointmentPage() {
  await requireUser();
  const [opportunities, contacts] = await Promise.all([
    prisma.opportunity.findMany({
      where: { status: { not: "DISCARDED" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, zone: true, contactId: true },
    }),
    prisma.contact.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const opportunityOptions = opportunities.map((o) => ({
    id: o.id,
    name: `${o.title}${o.zone ? ` — ${o.zone}` : ""}`,
    contactId: o.contactId,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/citas"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la agenda
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Agendar nueva cita</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Programa una visita o reunión con un propietario, broker o cliente interesado.
        </p>
      </div>
      <AppointmentForm opportunities={opportunityOptions} contacts={contacts} />
    </div>
  );
}
