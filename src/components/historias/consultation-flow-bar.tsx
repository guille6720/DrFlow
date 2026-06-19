"use client";

import { ConsultationTimer, clearConsultationTimer } from "@/components/historias/consultation-timer";
import { FinalizeConsultationButton } from "@/components/historias/finalize-consultation-button";
import { cn } from "@/lib/utils/cn";
import type { Patient } from "@/types/database";
import { User, FileText, Stethoscope, ClipboardList, Pill } from "lucide-react";

export type ConsultationStep = "motivo" | "evolucion" | "diagnostico" | "indicaciones";

const STEPS: { id: ConsultationStep; label: string; icon: typeof FileText }[] = [
  { id: "motivo", label: "Motivo", icon: FileText },
  { id: "evolucion", label: "Evolución", icon: ClipboardList },
  { id: "diagnostico", label: "Diagnóstico", icon: Stethoscope },
  { id: "indicaciones", label: "Indicaciones", icon: Pill },
];

interface ConsultationFlowBarProps {
  appointmentId: string;
  patient?: Patient | null;
  activeStep: ConsultationStep;
  onStepChange: (step: ConsultationStep) => void;
}

/** Barra fija estilo DrApp: paciente + timer + pasos + finalizar. */
export function ConsultationFlowBar({
  appointmentId,
  patient,
  activeStep,
  onStepChange,
}: ConsultationFlowBarProps) {
  const stepIndex = STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-blue-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">
              {patient
                ? `${patient.last_name}, ${patient.first_name}`
                : "Consulta en curso"}
            </p>
            <p className="text-xs text-slate-500">Historia clínica · turno vinculado</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConsultationTimer storageKey={appointmentId} />
          <FinalizeConsultationButton appointmentId={appointmentId} />
        </div>
      </div>

      <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.id === activeStep;
          const isDone = i < stepIndex;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange(step.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : isDone
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {step.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

export { clearConsultationTimer, STEPS };
