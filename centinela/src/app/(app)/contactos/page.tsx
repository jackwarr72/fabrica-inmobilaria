import Link from "next/link";
import { Suspense } from "react";
import { ContactKind, Prisma } from "@prisma/client";
import { Plus, ChevronLeft, ChevronRight, Users, Sparkles } from "lucide-react";
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
import { CONTACT_KIND_LABELS } from "@/lib/labels";
import { ContactsFilters } from "./filters";

const PAGE_SIZE = 20;

export default async function ContactosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const raw = await searchParams;

  const rawKind = typeof raw.kind === "string" ? raw.kind : undefined;
  const rawQ = typeof raw.q === "string" ? raw.q.trim() : undefined;
  const rawPage = typeof raw.page === "string" ? parseInt(raw.page, 10) : 1;
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const kind =
    rawKind && Object.keys(CONTACT_KIND_LABELS).includes(rawKind)
      ? (rawKind as ContactKind)
      : undefined;

  const where: Prisma.ContactWhereInput = {
    ...(kind ? { kind } : {}),
    ...(rawQ
      ? {
          OR: [
            { name: { contains: rawQ, mode: "insensitive" } },
            { phone: { contains: rawQ, mode: "insensitive" } },
            { email: { contains: rawQ, mode: "insensitive" } },
            { zone: { contains: rawQ, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [contacts, totalCount, newContacts7Days] = await prisma.$transaction([
    prisma.contact.findMany({
      where,
      include: {
        assignedTo: true,
        _count: {
          select: { opportunities: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.contact.count({ where }),
    prisma.contact.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function buildPaginationUrl(targetPage: number) {
    const params = new URLSearchParams();
    if (rawQ) params.set("q", rawQ);
    if (kind) params.set("kind", kind);
    if (targetPage > 1) params.set("page", targetPage.toString());
    const qs = params.toString();
    return `/contactos${qs ? `?${qs}` : ""}`;
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Directorio de Contactos
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <Sparkles className="h-3 w-3" /> +{newContacts7Days} en últimos 7 días
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "contacto registrado" : "contactos registrados"} ·
            Página {currentPage} de {totalPages}
          </p>
        </div>
        <Link
          href="/contactos/nueva"
          className={buttonVariants({ variant: "default", size: "default" })}
        >
          <Plus className="h-4 w-4 mr-1" /> Nuevo contacto
        </Link>
      </div>

      <Suspense fallback={null}>
        <ContactsFilters />
      </Suspense>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {contacts.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-base font-medium text-slate-800">
              No se encontraron contactos
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Intenta cambiar los filtros o registra un nuevo contacto.
            </p>
            <div className="mt-5">
              <Link
                href="/contactos/nueva"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Registrar contacto
              </Link>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/75 hover:bg-slate-50/75">
                <TableHead className="font-semibold text-slate-900">Nombre</TableHead>
                <TableHead className="font-semibold text-slate-900">Tipo</TableHead>
                <TableHead className="font-semibold text-slate-900">Teléfono</TableHead>
                <TableHead className="font-semibold text-slate-900">Correo</TableHead>
                <TableHead className="font-semibold text-slate-900">Zona</TableHead>
                <TableHead className="font-semibold text-slate-900">Oportunidades</TableHead>
                <TableHead className="font-semibold text-slate-900">Último contacto</TableHead>
                <TableHead className="font-semibold text-slate-900">Asesor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="font-medium max-w-[220px]">
                    <Link
                      href={`/contactos/${c.id}`}
                      className="font-semibold text-slate-950 hover:text-emerald-700 hover:underline block truncate"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {CONTACT_KIND_LABELS[c.kind]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {c.phone || c.phone2 || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-[180px]">
                    {c.email || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-[140px]">
                    {c.zone || "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-900">
                    <span className="inline-flex items-center justify-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {c._count.opportunities}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                    {c.lastContactAt ? formatDateTime(c.lastContactAt) : "Nunca"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 truncate max-w-[140px]">
                    {c.assignedTo?.name || "Sin asignar"}
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
