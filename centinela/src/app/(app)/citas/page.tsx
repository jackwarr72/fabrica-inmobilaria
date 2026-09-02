import Link from "next/link";
import { Suspense } from "react";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { Plus, ChevronLeft, ChevronRight, Calendar, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { APPOINTMENT_BADGE_VARIANT, APPOINTMENT_STATUS_LABELS } from "@/lib/labels";
import { AppointmentsFilters } from "./filters";
import { AppointmentStatusActions } from "./status-actions";

const PAGE_SIZE = 20;

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const raw = await searchParams;

  const rawStatus = typeof raw.status === "string" ? raw.status : undefined;
  const rawPage = typeof raw.page === "string" ? parseInt(raw.page, 10) : 1;
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const status =
    rawStatus && Object.keys(APPOINTMENT_STATUS_LABELS).includes(rawStatus)
      ? (rawStatus as AppointmentStatus)
      : undefined;

  const where: Prisma.AppointmentWhereInput = {
    ...(status ? { status } : {}),
  };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [appointments, totalCount, scheduled7Days] = await prisma.$transaction([
    prisma.appointment.findMany({
      where,
      include: {
        opportunity: true,
        contact: true,
        user: true,
      },
      orderBy: { scheduledAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.appointment.count({ where }),
    prisma.appointment.count({
      where: { scheduledAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function buildPaginationUrl(targetPage: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (targetPage > 1) params.set("page", targetPage.toString());
    const qs = params.toString();
    return `/citas${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Agenda de Citas
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <Sparkles className="h-3 w-3" /> {scheduled7Days} citas en últimos 7 días
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "cita registrada" : "citas registradas"} · Página{" "}
            {currentPage} de {totalPages}
          </p>
        </div>
        <Link
          href="/citas/nueva"
          className={buttonVariants({ variant: "default", size: "default" })}
        >
          <Plus className="h-4 w-4 mr-1" /> Agendar cita
        </Link>
      </div>

      <Suspense fallback={null}>
        <AppointmentsFilters />
      </Suspense>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {appointments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Calendar className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-base font-medium text-slate-800">
              No se encontraron citas
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Intenta cambiar los filtros o programa una nueva cita.
            </p>
            <div className="mt-5">
              <Link
                href="/citas/nueva"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Agendar cita
              </Link>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/75 hover:bg-slate-50/75">
                <TableHead className="font-semibold text-slate-900">Fecha y hora</TableHead>
                <TableHead className="font-semibold text-slate-900">Oportunidad / Inmueble</TableHead>
                <TableHead className="font-semibold text-slate-900">Contacto</TableHead>
                <TableHead className="font-semibold text-slate-900">Asesor</TableHead>
                <TableHead className="font-semibold text-slate-900">Lugar o enlace</TableHead>
                <TableHead className="font-semibold text-slate-900">Estatus</TableHead>
                <TableHead className="font-semibold text-slate-900 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appt) => (
                <TableRow key={appt.id} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="font-medium text-slate-900 whitespace-nowrap">
                    {formatDateTime(appt.scheduledAt)}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    {appt.opportunity ? (
                      <Link
                        href={`/oportunidades/${appt.opportunity.id}`}
                        className="font-medium text-slate-950 hover:text-emerald-700 hover:underline block truncate text-sm"
                      >
                        {appt.opportunity.title}
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    {appt.contact ? (
                      <Link
                        href={`/contactos/${appt.contact.id}`}
                        className="font-medium text-sky-700 hover:underline block truncate text-sm"
                      >
                        {appt.contact.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-[140px]">
                    {appt.user?.name || "Sin asesor"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-[180px]">
                    {appt.locationOrUrl || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={APPOINTMENT_BADGE_VARIANT[appt.status]} className="text-xs">
                      {APPOINTMENT_STATUS_LABELS[appt.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {appt.status === "SCHEDULED" ? (
                      <AppointmentStatusActions appointmentId={appt.id} />
                    ) : (
                      <span className="text-xs text-slate-400">Finalizada</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1} -{" "}
            {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={buildPaginationUrl(currentPage - 1)}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: currentPage <= 1 ? "pointer-events-none opacity-50" : "",
              })}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Link>
            <span className="text-xs text-slate-600">
              {currentPage} / {totalPages}
            </span>
            <Link
              href={buildPaginationUrl(currentPage + 1)}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: currentPage >= totalPages ? "pointer-events-none opacity-50" : "",
              })}
            >
              Siguiente <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
