"use client";

import { Calendar, CheckCircle2, ClipboardList, Pill, Stethoscope } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import {
  journeyProgressPercent,
  journeyStepIndex,
  type ConsultationJourneyStepId,
  type ConsultationJourneyStepMeta,
  type ConsultationJourneyStepStatus,
} from "@/lib/utils/consultation-journey";

const STEP_ICONS: Record<ConsultationJourneyStepId, typeof Stethoscope> = {
  evolution: Stethoscope,
  prescription: Pill,
  order: ClipboardList,
  follow_up: Calendar,
  finish: CheckCircle2,
};

type Props = {
  steps: ConsultationJourneyStepMeta[];
  currentStep: ConsultationJourneyStepId;
  stepStatus: Partial<Record<ConsultationJourneyStepId, ConsultationJourneyStepStatus>>;
  onStepClick?: (step: ConsultationJourneyStepId) => void;
};

export function ConsultationJourneyStepper({
  steps,
  currentStep,
  stepStatus,
  onStepClick,
}: Props) {
  const currentIndex = journeyStepIndex(steps, currentStep);

  return (
    <div className="drflow-consultation-journey-stepper rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-blue-800">
          Flujo de consulta
        </p>
        <p className="text-xs text-blue-700">
          Paso {currentIndex + 1} de {steps.length}
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.id];
          const isActive = step.id === currentStep;
          const status = stepStatus[step.id];
          const isDone = status === "completed" || status === "skipped";
          const isSkipped = status === "skipped";

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : isDone
                    ? isSkipped
                      ? "bg-slate-100 text-slate-600"
                      : "bg-emerald-100 text-emerald-800"
                    : index <= currentIndex
                      ? "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      : "bg-white/70 text-slate-400"
              )}
              title={isSkipped ? `${step.label} (omitido)` : step.label}
            >
              <Icon className="h-3.5 w-3.5" />
              {step.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${journeyProgressPercent(steps, currentStep)}%` }}
        />
      </div>
    </div>
  );
}
