const kpis = [
  { label: "Propiedades nuevas captadas", value: "≥ 20 / día" },
  { label: "Contactos nuevos", value: "≥ 50 / semana" },
  { label: "Tasa de calificación", value: "≥ 30%" },
  { label: "Citas agendadas", value: "≥ 10 / semana" },
  { label: "Tiempo a primer contacto", value: "< 24 horas" },
];

export default function Home() {
  return (
    <main className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
          Centinela
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Inteligencia de captación inmobiliaria para actuar antes que la competencia.
        </h1>
        <p className="max-w-2xl text-base text-slate-600">
          Centraliza oportunidades, valida contactos y convierte la prospección en un pipeline
          medible con foco en exclusivas y seguimiento operativo.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{kpi.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{kpi.value}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
