import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Edit2,
  Mail,
  Phone,
  Building,
  User as UserIcon,
} from "lucide-react";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  APPOINTMENT_BADGE_VARIANT,
  APPOINTMENT_STATUS_LABELS,
  CONTACT_KIND_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_BADGE_VARIANT,
} from "@/lib/labels";
import { TouchButton } from "../touch-button";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      assignedTo: true,
      opportunities: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 10,
        include: {
          opportunity: true,
        },
      },
    },
  });

  if (!contact) notFound();

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/contactos"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver al directorio
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {contact.name}
            </h1>
            <Badge variant="outline" className="text-xs">
              {CONTACT_KIND_LABELS[contact.kind]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {contact.zone ? `Zona: ${contact.zone} · ` : ""}
            Registrado el {formatDateTime(contact.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TouchButton contactId={contact.id} />
          <Link
            href={`/contactos/${contact.id}/editar`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact Info (1 Column) */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos de contacto</CardTitle>
              <CardDescription>Información y canales de comunicación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Teléfono</span>
                <div className="mt-0.5 flex items-center gap-2 font-medium text-slate-900">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="hover:underline">
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground font-normal">Sin teléfono</span>
                  )}
                </div>
              </div>

              {contact.phone2 ? (
                <div>
                  <span className="text-xs text-muted-foreground block">Teléfono secundario</span>
                  <div className="mt-0.5 flex items-center gap-2 text-slate-700">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <a href={`tel:${contact.phone2}`} className="hover:underline">
                      {contact.phone2}
                    </a>
                  </div>
                </div>
              ) : null}

              <div>
                <span className="text-xs text-muted-foreground block">Correo electrónico</span>
                <div className="mt-0.5 flex items-center gap-2 text-slate-900">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="hover:underline truncate">
                      {contact.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground font-normal">Sin correo</span>
                  )}
                </div>
              </div>

              {contact.socialHandle ? (
                <div>
                  <span className="text-xs text-muted-foreground block">Red social / WhatsApp</span>
                  <p className="mt-0.5 font-medium text-slate-800">{contact.socialHandle}</p>
                </div>
              ) : null}

              <div>
                <span className="text-xs text-muted-foreground block">Asesor asignado</span>
                <div className="mt-0.5 flex items-center gap-2 text-slate-900">
                  <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">
                    {contact.assignedTo?.name || "Sin asesor asignado"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block">Último contacto registrado</span>
                <p className="mt-0.5 font-medium text-slate-900">
                  {contact.lastContactAt ? formatDateTime(contact.lastContactAt) : "Nunca"}
                </p>
              </div>

              {contact.notes ? (
                <div className="border-t pt-3">
                  <span className="text-xs text-muted-foreground block">Notas comerciales</span>
                  <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{contact.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Opportunities & Appointments (2 Columns) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Related Opportunities */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Oportunidades asociadas</CardTitle>
                <CardDescription>Inmuebles promovidos o captados con este contacto</CardDescription>
              </div>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {contact.opportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin oportunidades asociadas.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {contact.opportunities.map((opp) => (
                    <div key={opp.id} className="py-3 flex items-center justify-between text-sm">
                      <div className="min-w-0 pr-4">
                        <Link
                          href={`/oportunidades/${opp.id}`}
                          className="font-semibold text-slate-950 hover:text-emerald-700 hover:underline block truncate"
                        >
                          {opp.title}
                        </Link>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span>{PROPERTY_TYPE_LABELS[opp.propertyType]}</span>
                          <span>·</span>
                          <span>{formatMoney(opp.price)}</span>
                          <span>·</span>
                          <span>{opp.zone ?? "Sin zona"}</span>
                        </div>
                      </div>
                      <Badge variant={STATUS_BADGE_VARIANT[opp.status]} className="shrink-0 text-xs">
                        {OPPORTUNITY_STATUS_LABELS[opp.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointments History */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Historial de citas</CardTitle>
                <CardDescription>Reuniones y visitas agendadas</CardDescription>
              </div>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {contact.appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin citas registradas con este contacto.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {contact.appointments.map((appt) => (
                    <div key={appt.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {formatDateTime(appt.scheduledAt)}
                        </p>
                        {appt.opportunity ? (
                          <Link
                            href={`/oportunidades/${appt.opportunity.id}`}
                            className="text-xs text-sky-700 hover:underline block truncate mt-0.5"
                          >
                            Inmueble: {appt.opportunity.title}
                          </Link>
                        ) : null}
                        {appt.locationOrUrl ? (
                          <p className="text-xs text-slate-500 mt-0.5">{appt.locationOrUrl}</p>
                        ) : null}
                      </div>
                      <Badge
                        variant={APPOINTMENT_BADGE_VARIANT[appt.status]}
                        className="shrink-0 text-xs"
                      >
                        {APPOINTMENT_STATUS_LABELS[appt.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
