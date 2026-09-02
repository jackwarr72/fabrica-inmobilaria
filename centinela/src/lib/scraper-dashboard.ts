import { prisma } from "@/lib/prisma";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getScraperDashboardData() {
  const [
    totalProperties,
    propertiesToday,
    matchedProperties,
    pendingValidation,
    activeSources,
    latestProperties,
    sourceSummaries,
  ] = await Promise.all([
    prisma.opportunity.count(),
    prisma.opportunity.count({
      where: { createdAt: { gte: startOfToday() } },
    }),
    prisma.opportunity.count({
      where: { sourceNotes: { contains: "match_status=matched" } },
    }),
    prisma.opportunity.count({
      where: { status: "DETECTED" },
    }),
    prisma.source.count({ where: { isActive: true } }),
    prisma.opportunity.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { source: true },
    }),
    prisma.source.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { opportunities: true } } },
    }),
  ]);

  return {
    totalProperties,
    propertiesToday,
    matchedProperties,
    pendingValidation,
    activeSources,
    latestProperties,
    sourceSummaries,
  };
}

export type ScraperDashboardData = Awaited<ReturnType<typeof getScraperDashboardData>>;

export function formatScraperPrice(value: unknown) {
  if (value === null || value === undefined) return "Precio no disponible";

  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Precio no disponible";

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatScraperDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}
