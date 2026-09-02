import Link from "next/link";
import { Activity, ArrowLeft, ExternalLink, Radar, Terminal } from "lucide-react";

import {
  formatScraperDate,
  formatScraperPrice,
  getScraperDashboardData,
} from "@/lib/scraper-dashboard";

export const dynamic = "force-dynamic";

export default async function ScraperPage() {
  const data = await getScraperDashboardData();

  return (
    <main className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al dashboard
          </Link>
          <div className="mt-5 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <Radar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                Centro de monitoreo
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Scraper</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">
            Consulta la cobertura de tus fuentes, revisa las propiedades que llegaron desde SQLite y
            confirma el estado de la sincronización.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {data.activeSources} fuentes activas
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Registros en Centinela</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{data.totalProperties}</p>
          <p className="mt-1 text-xs text-slate-400">importados desde las fuentes</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Detectados hoy</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{data.propertiesToday}</p>
          <p className="mt-1 text-xs text-slate-400">nuevas oportunidades</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Marcados por matcher</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{data.matchedProperties}</p>
          <p className="mt-1 text-xs text-slate-400">con señal de coincidencia</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Feed de entrada
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Propiedades del scraper</h2>
            </div>
            <Activity className="h-5 w-5 text-sky-600" />
          </div>
          {data.latestProperties.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-medium text-slate-700">El feed está vacío</p>
              <p className="mt-1 text-sm text-slate-500">
                Ejecuta la sincronización después de correr el spider.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.latestProperties.map((property) => (
                <div
                  key={property.id}
                  className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{property.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {property.source?.name ?? "Fuente no identificada"}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Recibida el {formatScraperDate(property.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end">
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
                        Ver fuente <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Distribución
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Fuentes activas</h2>
            <div className="mt-6 space-y-4">
              {data.sourceSummaries.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
                >
                  <span className="truncate text-sm font-medium text-slate-700">{source.name}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                    {source._count.opportunities}
                  </span>
                </div>
              ))}
              {data.sourceSummaries.length === 0 ? (
                <p className="text-sm text-slate-500">No hay fuentes activas.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10">
            <div className="flex items-center gap-2 text-emerald-300">
              <Terminal className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                Sincronización local
              </p>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Con el servidor de Centinela activo, ejecuta el runner para enviar las propiedades a
              este panel.
            </p>
            <code className="mt-4 block rounded-xl bg-white/10 px-3 py-3 text-xs leading-5 text-slate-200">
              .\run_scraper.bat
            </code>
          </div>
        </aside>
      </section>
    </main>
  );
}
