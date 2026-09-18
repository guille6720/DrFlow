import { Calendar, FileText, Pill } from "lucide-react";
import type { ReactNode } from "react";

function MockChrome({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-xs font-medium text-slate-500">{title}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function MarketingHcMock() {
  return (
    <MockChrome title="Historia clínica — María G. · PAMI">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {["HTA", "DM2", "Alergia: AAS"].map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SOAP · Hoy</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            <span className="font-medium text-slate-900">S:</span> Control rutinario, refiere
            cefalea leve ocasional.
            <br />
            <span className="font-medium text-slate-900">O:</span> PA 132/84, FC 72.
            <br />
            <span className="font-medium text-slate-900">A/P:</span> Ajuste conducta, control 30 días.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-teal-700">
          <FileText className="h-4 w-4" />
          Export PDF · Auditoría activa
        </div>
      </div>
    </MockChrome>
  );
}

export function MarketingAgendaMock() {
  return (
    <MockChrome title="Agenda — Miércoles 6 ago">
      <div className="space-y-2">
        {[
          { time: "09:00", name: "Juan P.", status: "Confirmado", tone: "bg-emerald-100 text-emerald-800" },
          { time: "09:30", name: "Ana R.", status: "En espera", tone: "bg-amber-100 text-amber-800" },
          { time: "10:00", name: "Carlos M.", status: "Turno web", tone: "bg-cyan-100 text-cyan-800" },
        ].map((row) => (
          <div
            key={row.time}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums text-slate-900">{row.time}</span>
              <span className="text-sm text-slate-700">{row.name}</span>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.tone}`}>
              {row.status}
            </span>
          </div>
        ))}
        <div className="mt-3 flex items-center gap-2 text-xs text-teal-700">
          <Calendar className="h-4 w-4" />
          Empezar consulta · Confirmar · Ausente
        </div>
      </div>
    </MockChrome>
  );
}

export function MarketingRecetasMock() {
  return (
    <MockChrome title="Receta · Ley 25.649">
      <div className="space-y-3">
        <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">
          <p className="text-sm font-semibold text-slate-900">Losartán 50 mg</p>
          <p className="text-xs text-slate-600">1 comp/día · 30 días</p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">
          <p className="text-sm font-semibold text-slate-900">Metformina 850 mg</p>
          <p className="text-xs text-slate-600">1 comp c/12h · 60 días</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg bg-[#25D366]/10 px-2 py-1 font-medium text-emerald-800">
            WhatsApp
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700">PDF</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-1 font-medium text-teal-800">
            <Pill className="h-3.5 w-3.5" />
            Vademécum
          </span>
        </div>
      </div>
    </MockChrome>
  );
}

export function MarketingHeroMock() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[color-mix(in_srgb,var(--primary)_20%,transparent)] to-[color-mix(in_srgb,var(--secondary)_20%,transparent)] blur-2xl"
        aria-hidden
      />
      <div className="relative space-y-4">
        <MarketingAgendaMock />
        <div className="absolute -bottom-6 -right-2 w-[88%] sm:-right-6">
          <div className="rounded-2xl border border-teal-200/80 bg-slate-900 p-4 text-white shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
              ✦ Asistente clínico
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Resumen listo antes de la consulta. Sugerencias de renovación y alertas de
              medicación — usted decide.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
