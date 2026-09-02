import Link from "next/link";
import { Suspense } from "react";
import {
  OperationType,
  OpportunityStatus,
  Prisma,
  PropertyType,
  Qualification,
} from "@prisma/client";
import { Plus, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
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
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  OPERATION_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  QUALIFICATION_LABELS,
  STATUS_BADGE_VARIANT,
} from "@/lib/labels";
import { OpportunitiesFilters } from "./filters";

const PAGE_SIZE = 20;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const raw = await searchParams;

  const rawStatus = typeof raw.status === "string" ? raw.status : undefined;
  const rawPropertyType = typeof raw.propertyType === "string" ? raw.propertyType : undefined;
  const rawOperation = typeof raw.operation === "string" ? raw.operation : undefined;
  const rawQualification = typeof raw.qualification === "string" ? raw.qualification : undefined;
  const rawQ = typeof raw.q === "string" ? raw.q.trim() : undefined;
  const rawPage = typeof raw.page === "string" ? parseInt(raw.page, 10) : 1;
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const status =
    rawStatus && Object.keys(OPPORTUNITY_STATUS_LABELS).includes(rawStatus)
      ? (rawStatus as OpportunityStatus)
      : undefined;

  const propertyType =
    rawPropertyType && Object.keys(PROPERTY_TYPE_LABELS).includes(rawPropertyType)
      ? (rawPropertyType as PropertyType)
      : undefined;

  const operation =
    rawOperation && Object.keys(OPERATION_LABELS).includes(rawOperation)
      ? (rawOperation as OperationType)
      : undefined;

  const qualification =
    rawQualification && Object.keys(QUALIFICATION_LABELS).includes(rawQualification)
      ? (rawQualification as Qualification)
      : undefined;

  const where: Prisma.OpportunityWhereInput = {
    ...(status ? { status } : {}),
    ...(propertyType ? { propertyType } : {}),
    ...(operation ? { operation } : {}),
    ...(qualification ? { qualification } : {}),
    ...(rawQ
      ? {
          OR: [
            { title: { contains: rawQ, mode: "insensitive" } },
            { zone: { contains: rawQ, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [opportunities, totalCount] = await prisma.$transaction([
    prisma.opportunity.findMany({
      where,
      include: {
        source: true,
        contact: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.opportunity.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function buildPaginationUrl(targetPage: number) {
    const params = new URLSearchParams();
    if (rawQ) params.set("q", rawQ);
    if (status) params.set("status", status);
    if (propertyType) params.set("propertyType", propertyType);
    if (operation) params.set("operation", operation);
    if (qualification) params.set("qualification", qualification);
    if (targetPage > 1) params.set("page", targetPage.toString());
    const qs = params.toString();
    return `/oportunidades${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Pipeline de Oportunidades
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "oportunidad" : "oportunidades"} encontradas · Página{" "}
            {currentPage} de {totalPages}
          </p>
        </div>
        <Link
          href="/oportunidades/nueva"
          className={buttonVariants({ variant: "default", size: "default" })}
        >
          <Plus className="h-4 w-4 mr-1" /> Nueva oportunidad
        </Link>
      </div>

      <Suspense fallback={null}>
        <OpportunitiesFilters />
      </Suspense>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {opportunities.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-base font-medium text-slate-800">
              No se encontraron oportunidades
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Intenta cambiar los filtros o registra una nueva oportunidad.
            </p>
            <div className="mt-5">
              <Link
                href="/oportunidades/nueva"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Registrar oportunidad
              </Link>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/75 hover:bg-slate-50/75">
                <TableHead className="font-semibold text-slate-900">Título / Inmueble</TableHead>
                <TableHead className="font-semibold text-slate-900">Tipo</TableHead>
                <TableHead className="font-semibold text-slate-900">Operación</TableHead>
                <TableHead className="font-semibold text-slate-900">Precio</TableHead>
                <TableHead className="font-semibold text-slate-900">Zona</TableHead>
                <TableHead className="font-semibold text-slate-900">Estatus</TableHead>
                <TableHead className="font-semibold text-slate-900">Calificación</TableHead>
                <TableHead className="font-semibold text-slate-900">Fuente</TableHead>
                <TableHead className="font-semibold text-slate-900">Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((opp) => (
                <TableRow key={opp.id} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="font-medium max-w-[280px]">
                    <Link
                      href={`/oportunidades/${opp.id}`}
                      className="font-semibold text-slate-950 hover:text-emerald-700 hover:underline block truncate"
                    >
                      {opp.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {PROPERTY_TYPE_LABELS[opp.propertyType]}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {OPERATION_LABELS[opp.operation]}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-900">
                    {formatMoney(opp.price)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-[150px]">
                    {opp.zone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[opp.status]}>
                      {OPPORTUNITY_STATUS_LABELS[opp.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {opp.qualification ? (
                      <span
                        className={`inline-flex items-center font-medium ${
                          opp.qualification === "HIGH"
                            ? "text-emerald-700 font-semibold"
                            : opp.qualification === "MEDIUM"
                            ? "text-amber-700"
                            : "text-slate-500"
                        }`}
                      >
                        {QUALIFICATION_LABELS[opp.qualification]}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-[140px]">
                    {opp.source?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDateTime(opp.createdAt)}
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
