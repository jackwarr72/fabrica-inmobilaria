export default function HomePage() {
  return (
    <main className="p-8 space-y-8">
      <h1 className="text-4xl font-bold">Centinela</h1>
      <p className="text-lg text-gray-600">
        Plataforma interna de inteligencia comercial para captar propiedades antes que la competencia.
      </p>
      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="text-xl font-semibold">KPI 1</h2>
          <p className="text-2xl font-bold">---</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="text-xl font-semibold">KPI 2</h2>
          <p className="text-2xl font-bold">---</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="text-xl font-semibold">KPI 3</h2>
          <p className="text-2xl font-bold">---</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="text-xl font-semibold">KPI 4</h2>
          <p className="text-2xl font-bold">---</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="text-xl font-semibold">KPI 5</h2>
          <p className="text-2xl font-bold">---</p>
        </div>
      </section>
    </main>
  );
}
