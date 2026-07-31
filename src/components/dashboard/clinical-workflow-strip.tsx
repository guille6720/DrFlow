import Link from "next/link";
import { Calendar, Stethoscope, ScrollText, Send, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const steps = [
  {
    label: "Agenda",
    desc: "Turno del día",
    href: "/agenda?view=day",
    icon: Calendar,
  },
  {
    label: "Consulta",
    desc: "Historia clínica",
    href: "/historias/nueva",
    icon: Stethoscope,
  },
  {
    label: "Receta",
    desc: "Ley 25.649",
    href: "/recetas",
    icon: ScrollText,
  },
  {
    label: "Compartir",
    desc: "WhatsApp / PDF",
    href: "/historias",
    icon: Send,
  },
] as const;

/** Flujo clínico visual: diferenciador vs turneras puras (solo agenda). */
export function ClinicalWorkflowStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "drflow-card-light rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-md shadow-slate-200/40",
        className
      )}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-800/80">
        Flujo DrFlow — de turno a receta en un solo lugar
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <Link
            key={step.label}
            href={step.href}
            className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3 transition-all hover:border-teal-200 hover:bg-teal-50/60 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-sm shadow-teal-500/25">
              <step.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{step.label}</p>
              <p className="truncate text-xs text-slate-500">{step.desc}</p>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="hidden h-4 w-4 shrink-0 text-teal-300 lg:block" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
