import Link from "next/link";
import { Activity, ArrowUpRight, Database, ExternalLink, Radar, Target } from "lucide-react";

import {
  formatScraperDate,
  formatScraperPrice,
  getScraperDashboardData,
} from "@/lib/scraper-dashboard";

export const dynamic = "force-dynamic";

const metricCards = [
  {
    key: "propertiesToday",
    label: "Detectadas hoy",
    helper: "nuevas oportunidades",
    icon: Radar,
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "totalProperties",
    label: "En el radar",
    helper: "propiedades importadas",
    icon: Database,
    accent: "bg-sky-50 text-sky-700",
  },
  {
    key: "pendingValidation",
    label: "Por validar",
    helper: "requieren revisión",
    icon: Activity,
    accent: "bg-amber-50 text-amber-700",
  },
  {
    key: "matchedProperties",
    label: "Coincidencias",
    helper: "marcadas por matcher",
    icon: Target,
    accent: "bg-violet-50 text-violet-700",
  },
] as const;

function truncate(value: string | null, length = 88) {
  if (!value) return "Sin descripción disponible";
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export default async function Home() {
  const data = await getScraperDashboardData();
  const metrics = new Map([
    ["propertiesToday", data.propertiesToday],
    ["totalProperties", data.totalProperties],
    ["pendingValidation", data.pendingValidation],
    ["matchedProperties", data.matchedProperties],
  ]);

  return (
    <main className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-10">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.26em] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.15)]" />
              Radar de captación
            </div>
            <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Detecta oportunidades antes que la competencia.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              El scraper alimenta este tablero con propiedades de tus fuentes configuradas. Revisa
              lo nuevo, valida las mejores señales y convierte cada hallazgo en seguimiento.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <div className="rounded-xl bg-emerald-400/15 p-2 text-emerald-300">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-white">Scraper conectado</p>
              <p className="text-xs text-slate-400">{data.activeSources} fuentes activas</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.key}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {metrics.get(metric.key)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{metric.helper}</p>
                </div>
                <div className={`rounded-xl p-2.5 ${metric.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                Actividad reciente
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Últimas propiedades detectadas
              </h2>
            </div>
            <Link
              href="/oportunidades"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 transition hover:text-emerald-700"
            >
              Ver todas
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          {data.latestProperties.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Radar className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700">Aún no hay propiedades importadas</p>
              <p className="mt-1 text-sm text-slate-500">
                Ejecuta el runner del scraper y sincroniza sus resultados.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.latestProperties.map((property) => (
                <div
                  key={property.id}
                  className="flex flex-col gap-3 px-6 py-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {property.title}
                      </p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                      {truncate(property.description)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>{property.source?.name ?? "Fuente no identificada"}</span>
                      <span>·</span>
                      <span>{formatScraperDate(property.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatScraperPrice(property.price)}
                    </p>
                    {property.sourceUrl ? (
                      <a
                        href={property.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900"
                      >
                        Abrir fuente <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Cobertura
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Fuentes del scraper
              </h2>
            </div>
            <Radar className="h-5 w-5 text-sky-600" />
          </div>
          <div className="mt-6 space-y-5">
            {data.sourceSummaries.length === 0 ? (
              <p className="text-sm text-slate-500">No hay fuentes activas configuradas.</p>
            ) : (
              data.sourceSummaries.map((source) => {
                const percentage = data.totalProperties
                  ? Math.round((source._count.opportunities / data.totalProperties) * 100)
                  : 0;
                return (
                  <div key={source.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-700">{source.name}</span>
                      <span className="shrink-0 text-xs font-semibold text-slate-400">
                        {source._count.opportunities}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all"
                        style={{
                          width: `${Math.max(percentage, source._count.opportunities ? 4 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-8 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Siguiente paso
            </p>
            <p className="mt-2 text-sm leading-5 text-slate-600">
              Valida las oportunidades nuevas y asigna las mejores a un asesor para activar el
              primer contacto.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
