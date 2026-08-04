"use client";

import { CheckCircle2, Circle, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  ConsultationJourneyStepId,
  ConsultationJourneyStepMeta,
  ConsultationJourneyStepStatus,
} from "@/lib/utils/consultation-journey";

type Props = {
  steps: ConsultationJourneyStepMeta[];
  stepStatus: Partial<Record<ConsultationJourneyStepId, ConsultationJourneyStepStatus>>;
  patientName: string;
  finalizing: boolean;
  onFinalize: () => void;
  onBack: () => void;
};

function StatusIcon({ status }: { status?: ConsultationJourneyStepStatus }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  }
  if (status === "skipped") {
    return <MinusCircle className="h-4 w-4 shrink-0 text-slate-400" />;
  }
  return <Circle className="h-4 w-4 shrink-0 text-slate-300" />;
}

function statusLabel(status?: ConsultationJourneyStepStatus): string {
  if (status === "completed") return "Completado";
  if (status === "skipped") return "Omitido";
  return "Pendiente";
}

export function ConsultationJourneyFinishStep({
  steps,
  stepStatus,
  patientName,
  finalizing,
  onFinalize,
  onBack,
}: Props) {
  const actionableSteps = steps.filter((step) => step.id !== "finish");

  return (
    <Card title="Cerrar consulta">
      <p className="mb-4 text-sm text-slate-600">
        Revisá el resumen de la atención de <strong>{patientName}</strong> y cerrá el turno cuando
        esté todo listo.
      </p>

      <ul className="mb-6 space-y-2">
        {actionableSteps.map((step) => {
          const status = stepStatus[step.id];
          return (
            <li
              key={step.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 font-medium text-slate-800">
                <StatusIcon status={status} />
                {step.label}
              </span>
              <span className="text-xs text-slate-500">{statusLabel(status)}</span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          loading={finalizing}
          onClick={onFinalize}
          className="border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <CheckCircle2 className="h-4 w-4" />
          Cerrar consulta y finalizar
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>
          Volver al flujo
        </Button>
      </div>
    </Card>
  );
}
