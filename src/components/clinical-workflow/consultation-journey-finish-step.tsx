"use client";

import { CheckCircle2, Circle, MinusCircle } from "lucide-react";
import { CloseEncounterWizardPanel } from "@/components/clinical-workflow/close-encounter-wizard-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  ConsultationJourneyStepId,
  ConsultationJourneyStepMeta,
  ConsultationJourneyStepStatus,
} from "@/lib/utils/consultation-journey";
import type { PhysicianAssistContext } from "@/lib/utils/physician-assist-types";

type Props = {
  steps: ConsultationJourneyStepMeta[];
  stepStatus: Partial<Record<ConsultationJourneyStepId, ConsultationJourneyStepStatus>>;
  patientName: string;
  assistContext: PhysicianAssistContext;
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
  assistContext,
  finalizing,
  onFinalize,
  onBack,
}: Props) {
  const actionableSteps = steps.filter((step) => step.id !== "finish");

  return (
    <div className="space-y-4">
      <Card title="Resumen del journey">
        <p className="mb-4 text-sm text-slate-600">
          Revisá los pasos completados de <strong>{patientName}</strong> antes de cerrar el turno.
        </p>

        <ul className="space-y-2">
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
      </Card>

      <Card title="Asistente de cierre">
        <CloseEncounterWizardPanel
          patientName={patientName}
          context={assistContext}
          compact
        />
      </Card>

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
    </div>
  );
}
