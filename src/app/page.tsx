import { Building2, Users, Calendar, TrendingUp, ShieldCheck, Clock } from 'lucide-react';

export default function Home() {
  const user = {
    name: 'Analista Principal',
    role: 'ADMIN',
    zone: 'Toluca-Metepec',
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Building2 className="text-indigo-500 w-9 h-9" />
              <h1 className="text-3xl font-extrabold tracking-tight text-white">Centinela</h1>
              <span className="bg-indigo-500/10 text-indigo-400 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-500/20">
                Corredor Toluca-Metepec
              </span>
            </div>
            <p className="text-slate-400 mt-1">Plataforma de Inteligencia Comercial y Gestión Inmobiliaria</p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl shadow-inner">
            <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
              <ShieldCheck className="text-emerald-400 w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs text-indigo-400 uppercase tracking-wider font-medium">Rol: {user.role}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/80 border border-slate-800/80 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Captación Diaria</span>
              <TrendingUp className="text-emerald-400 w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-white mt-3">≥ 20</p>
            <span className="text-xs text-slate-500 mt-1 block">Propiedades / Inmuebles</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Prospección Semanal</span>
              <Users className="text-indigo-400 w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-white mt-3">≥ 50</p>
            <span className="text-xs text-slate-500 mt-1 block">Contactos calificados</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Citas Agendadas</span>
              <Calendar className="text-amber-400 w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-white mt-3">≥ 10</p>
            <span className="text-xs text-slate-500 mt-1 block">Visitas semanales</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Primer Contacto</span>
              <Clock className="text-cyan-400 w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-white mt-3">&lt; 24h</p>
            <span className="text-xs text-slate-500 mt-1 block">Tiempo de respuesta óptimo</span>
          </div>
        </div>

      </div>
    </main>
  );
}