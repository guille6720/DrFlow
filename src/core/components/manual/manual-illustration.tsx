"use client";

import { cn } from "@/shared/utils/cn";

type Kind =
  | "dashboard"
  | "agenda"
  | "pacientes"
  | "consulta"
  | "recetas"
  | "farmacologia"
  | "portal"
  | "config";

const FIGURES: Record<
  Kind,
  { title: string; boxes: { label: string; accent: string }[] }
> = {
  dashboard: {
    title: "Consultorio en vivo",
    boxes: [
      { label: "Próximo paciente", accent: "bg-blue-600 text-white" },
      { label: "Atender ahora", accent: "bg-white text-blue-900 border" },
      { label: "Progreso del día", accent: "bg-emerald-500/90 text-white" },
    ],
  },
  agenda: {
    title: "Agenda del día",
    boxes: [
      { label: "09:00 Confirmado", accent: "bg-emerald-100 text-emerald-900" },
      { label: "09:30 Pendiente · Web", accent: "bg-amber-100 text-amber-900" },
      { label: "Empezar consulta", accent: "bg-blue-600 text-white" },
    ],
  },
  pacientes: {
    title: "Ficha del paciente",
    boxes: [
      { label: "Alergias / Medicación", accent: "bg-red-50 text-red-800 border border-red-100" },
      { label: "Cobertura + N°", accent: "bg-teal-50 text-teal-900" },
      { label: "Renovar medicación", accent: "bg-violet-600 text-white" },
    ],
  },
  consulta: {
    title: "Flujo de consulta",
    boxes: [
      { label: "1 Motivo", accent: "bg-blue-600 text-white" },
      { label: "2 Evolución", accent: "bg-blue-500 text-white" },
      { label: "3 Diagnóstico", accent: "bg-blue-400 text-white" },
      { label: "4 Indicaciones", accent: "bg-blue-300 text-blue-950" },
    ],
  },
  recetas: {
    title: "Receta local",
    boxes: [
      { label: "Medicamentos", accent: "bg-slate-100 text-slate-800" },
      { label: "☑ Aviso REFEPS", accent: "bg-amber-100 text-amber-950" },
      { label: "PDF + WhatsApp", accent: "bg-emerald-600 text-white" },
    ],
  },
  farmacologia: {
    title: "Guía farmacológica",
    boxes: [
      { label: "Patología / CIE-10", accent: "bg-violet-600 text-white" },
      { label: "Síntomas → sugerencias", accent: "bg-violet-100 text-violet-950" },
      { label: "Agregar a receta", accent: "bg-white border text-violet-900" },
    ],
  },
  portal: {
    title: "App paciente (PWA)",
    boxes: [
      { label: "Pedir turno", accent: "bg-emerald-600 text-white" },
      { label: "Mis turnos", accent: "bg-blue-600 text-white" },
      { label: "Solicitar receta", accent: "bg-violet-600 text-white" },
      { label: "WhatsApp", accent: "bg-[#128C7E] text-white" },
    ],
  },
  config: {
    title: "Configuración",
    boxes: [
      { label: "Coberturas", accent: "bg-slate-800 text-white" },
      { label: "Horarios / bloqueos", accent: "bg-blue-700 text-white" },
      { label: "Equipo + link portal", accent: "bg-slate-100 text-slate-800" },
    ],
  },
};

/** Ilustraciones esquemáticas del manual (se regeneran con el código; no son screenshots estáticos). */
export function ManualIllustration({
  kind,
  className,
}: {
  kind: Kind;
  className?: string;
}) {
  const fig = FIGURES[kind];
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-slate-50 to-blue-50 p-4 shadow-sm",
        className
      )}
      aria-label={`Ilustración: ${fig.title}`}
    >
      <figcaption className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-800/80">
        {fig.title}
      </figcaption>
      <div className="grid gap-2 sm:grid-cols-2">
        {fig.boxes.map((box) => (
          <div
            key={box.label}
            className={cn(
              "rounded-xl px-3 py-3 text-center text-sm font-medium shadow-sm",
              box.accent
            )}
          >
            {box.label}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        Esquema del flujo en NexClinic — se actualiza con cada versión de la app.
      </p>
    </figure>
  );
}
