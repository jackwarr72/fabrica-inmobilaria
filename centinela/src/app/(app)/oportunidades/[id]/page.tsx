import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatMoney, hoursBetween } from "@/lib/format";
import {
  OPERATION_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  QUALIFICATION_LABELS,
  STATUS_BADGE_VARIANT,
} from "@/lib/labels";
import { ChangeStatusForm } from "./change-status-form";
import { QualificationForm } from "./qualification-form";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      source: true,
      contact: true,
      registeredBy: true,
      assignedTo: true,
      stageHistory: {
        orderBy: { createdAt: "desc" },
        include: { user: true },
      },
      priceEvents: {
        orderBy: { detectedAt: "desc" },
      },
    },
  });

  if (!opportunity) notFound();

  // SLA Calculation: Target is first contact within 24 hours of detection
  const now = new Date();
  const hoursSinceCreation = hoursBetween(opportunity.createdAt, now);
  const contactHours = opportunity.firstContactAt
    ? hoursBetween(opportunity.createdAt, opportunity.firstContactAt)
    : null;

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/oportunidades"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver al listado
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {opportunity.title}
            </h1>
            <Badge variant={STATUS_BADGE_VARIANT[opportunity.status]} className="text-xs">
              {OPPORTUNITY_STATUS_LABELS[opportunity.status]}
            </Badge>
            {opportunity.qualification ? (
              <Badge
                variant="outline"
                className={`text-xs ${
                  opportunity.qualification === "HIGH"
                    ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                    : opportunity.qualification === "MEDIUM"
                    ? "border-amber-500 text-amber-700 bg-amber-50"
                    : "border-slate-300 text-slate-600 bg-slate-50"
                }`}
              >
                Calificación: {QUALIFICATION_LABELS[opportunity.qualification]}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {PROPERTY_TYPE_LABELS[opportunity.propertyType]} en {OPERATION_LABELS[opportunity.operation]} ·{" "}
            {opportunity.zone ?? "Sin zona especificada"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Precio
          </p>
          <p className="text-2xl font-bold text-slate-950">
            {formatMoney(opportunity.price)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Details (2 Columns) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Property Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos del inmueble</CardTitle>
              <CardDescription>Información general y detalles de la oportunidad</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Tipo de inmueble</span>
                  <span className="font-medium">{PROPERTY_TYPE_LABELS[opportunity.propertyType]}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Operación</span>
                  <span className="font-medium">{OPERATION_LABELS[opportunity.operation]}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Zona / Municipio</span>
                  <span className="font-medium">{opportunity.zone ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Dirección</span>
                  <span className="font-medium">{opportunity.address ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Fuente</span>
                  <span className="font-medium">{opportunity.source?.name ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Liga de la publicación</span>
                  {opportunity.sourceUrl ? (
                    <a
                      href={opportunity.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-sky-600 hover:underline"
                    >
                      Abrir enlace original <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Registrado por</span>
                  <span className="font-medium">
                    {opportunity.registeredBy?.name ?? "Sistema / Ingestión"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Fecha de detección</span>
                  <span className="font-medium">{formatDateTime(opportunity.createdAt)}</span>
                </div>
              </div>

              {opportunity.sourceNotes ? (
                <div className="border-t pt-3 text-sm">
                  <span className="text-muted-foreground block text-xs">¿Cómo se detectó?</span>
                  <p className="mt-1 text-slate-700">{opportunity.sourceNotes}</p>
                </div>
              ) : null}

              {opportunity.description ? (
                <div className="border-t pt-3 text-sm">
                  <span className="text-muted-foreground block text-xs">Descripción</span>
                  <p className="mt-1 whitespace-pre-line text-slate-700">
                    {opportunity.description}
                  </p>
                </div>
              ) : null}

              {opportunity.qualificationNotes ? (
                <div className="border-t pt-3 text-sm">
                  <span className="text-muted-foreground block text-xs">Notas de calificación</span>
                  <p className="mt-1 text-slate-700">{opportunity.qualificationNotes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Contact & SLA Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Contacto y SLA</span>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
              <CardDescription>
                Objetivo de atención comercial: primer contacto en menos de 24 horas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground block text-xs">Contacto asociado</span>
                  {opportunity.contact ? (
                    <div>
                      <p className="font-semibold text-slate-900">{opportunity.contact.name}</p>
                      {opportunity.contact.phone ? (
                        <p className="text-xs text-slate-600">{opportunity.contact.phone}</p>
                      ) : null}
                      {opportunity.contact.email ? (
                        <p className="text-xs text-slate-600">{opportunity.contact.email}</p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Sin contacto asignado</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Asesor asignado</span>
                  <span className="font-medium">
                    {opportunity.assignedTo?.name ?? "Sin asignar"}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-slate-50">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide block">
                  Estado del SLA (meta &lt; 24h)
                </span>
                {opportunity.firstContactAt ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        contactHours !== null && contactHours <= 24
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }`}
                    />
                    <p className="font-medium text-slate-900">
                      Primer contacto realizado en{" "}
                      <strong>{contactHours} horas</strong> ({formatDateTime(opportunity.firstContactAt)})
                    </p>
                  </div>
                ) : hoursSinceCreation > 24 ? (
                  <div className="mt-1 flex items-center gap-2 text-rose-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <p className="font-semibold">
                      Fuera de meta: {hoursSinceCreation} horas sin primer contacto.
                    </p>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2 text-emerald-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <p className="font-medium">
                      Dentro de tiempo: {hoursSinceCreation}h transcurridas de 24h disponibles.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Price History Events Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cambios de precio detectados</CardTitle>
              <CardDescription>Historial de variaciones de valor en el mercado</CardDescription>
            </CardHeader>
            <CardContent>
              {opportunity.priceEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin cambios de precio registrados.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {opportunity.priceEvents.map((pe) => {
                    const oldP = pe.oldPrice ? Number(pe.oldPrice) : null;
                    const newP = Number(pe.newPrice);
                    const isDrop = oldP !== null && newP < oldP;
                    return (
                      <div key={pe.id} className="py-3 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {isDrop ? (
                            <TrendingDown className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-amber-600" />
                          )}
                          <div>
                            <p className="font-medium text-slate-900">
                              {pe.oldPrice ? `${formatMoney(pe.oldPrice)} → ` : ""}
                              {formatMoney(pe.newPrice)}
                            </p>
                            {pe.note ? (
                              <p className="text-xs text-muted-foreground">{pe.note}</p>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">
                          {formatDateTime(pe.detectedAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Actions, Qualification & Timeline */}
        <div className="space-y-6">
          {/* Change Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avanzar estatus</CardTitle>
              <CardDescription>Actualiza la etapa operativa de esta oportunidad</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangeStatusForm
                opportunityId={opportunity.id}
                currentStatus={opportunity.status}
              />
            </CardContent>
          </Card>

          {/* Qualification Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Calificación comercial</CardTitle>
              <CardDescription>Evalúa viabilidad y motivación del propietario</CardDescription>
            </CardHeader>
            <CardContent>
              <QualificationForm
                opportunityId={opportunity.id}
                currentQualification={opportunity.qualification}
              />
            </CardContent>
          </Card>

          {/* Stage History Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de etapas</CardTitle>
              <CardDescription>Registro de todas las transiciones del pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {opportunity.stageHistory.map((sh) => (
                  <div key={sh.id} className="relative text-xs">
                    <span className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-600 ring-2 ring-slate-100" />
                    <div>
                      <span className="font-semibold text-slate-900">
                        {OPPORTUNITY_STATUS_LABELS[sh.toStatus]}
                      </span>
                      {sh.fromStatus ? (
                        <span className="text-slate-500">
                          {" "}(desde {OPPORTUNITY_STATUS_LABELS[sh.fromStatus]})
                        </span>
                      ) : null}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      {formatDateTime(sh.createdAt)} · {sh.user?.name ?? "Sistema"}
                    </div>
                    {sh.note ? (
                      <p className="mt-1 text-slate-600 italic bg-slate-50 rounded p-1.5 border border-slate-100">
                        “{sh.note}”
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
