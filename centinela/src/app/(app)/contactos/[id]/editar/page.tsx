import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ContactForm, type ContactInitial } from "../../contact-form";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) notFound();

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const initial: ContactInitial = {
    name: contact.name,
    kind: contact.kind,
    phone: contact.phone ?? "",
    phone2: contact.phone2 ?? "",
    email: contact.email ?? "",
    socialHandle: contact.socialHandle ?? "",
    zone: contact.zone ?? "",
    notes: contact.notes ?? "",
    assignedToId: contact.assignedToId ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/contactos/${id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al detalle
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Editar contacto</h1>
        <p className="mt-1 text-sm text-muted-foreground">{contact.name}</p>
      </div>
      <ContactForm
        users={users}
        contactId={id}
        initial={initial}
        currentUserId={user.id}
      />
    </div>
  );
}
