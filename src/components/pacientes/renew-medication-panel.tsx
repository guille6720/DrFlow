"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrescriptionForm } from "@/components/recetas/prescription-form";
import { parseHabitualMedicationText } from "@/lib/utils/parse-habitual-meds";
import type { PrescriptionMedication } from "@/types/prescription";
import { Pill, RefreshCw } from "lucide-react";

interface Professional {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
}

interface Props {
  patientId: string;
  patientInsurance?: string | null;
  regularMedication?: string | null;
  lastMedications?: PrescriptionMedication[] | null;
  professionals: Professional[];
  canIssue: boolean;
  /** En ficha del paciente: solo botón + formulario colapsado */
  compact?: boolean;
}

export function RenewMedicationPanel({
  patientId,
  patientInsurance,
  regularMedication,
  lastMedications,
  professionals,
  canIssue,
  compact,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!canIssue || professionals.length === 0) return null;

  const initial =
    lastMedications && lastMedications.length > 0
      ? lastMedications
      : parseHabitualMedicationText(regularMedication);

  const hasSource = initial.length > 0;

  const body = !open ? (
    <div className="space-y-3">
      {!compact && (
        <p className="text-sm text-slate-600">
          {hasSource
            ? "Prefill desde la última receta o la medicación habitual. Revisá, aceptá el aviso legal y emití."
            : "No hay medicación habitual ni receta previa. Podés abrir el formulario y cargar a mano."}
        </p>
      )}
      {compact && (
        <p className="drflow-patient-chart-muted text-xs">
          {hasSource ? "Renovación con prefill desde última receta o habitual." : "Cargá medicación manualmente."}
        </p>
      )}
      {!compact && regularMedication && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Pill className="mr-1 inline h-4 w-4" />
          Habitual: {regularMedication}
        </p>
      )}
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <RefreshCw className="h-4 w-4" />
        Renovar medicación
      </Button>
    </div>
  ) : (
    <PrescriptionForm
      patientId={patientId}
      patientInsurance={patientInsurance}
      professionals={professionals}
      defaultProfessionalId={professionals[0]?.id}
      initialMedications={initial.length > 0 ? initial : undefined}
      onSuccess={() => setOpen(false)}
    />
  );

  if (compact) {
    return <div className="drflow-patient-chart-renew-compact">{body}</div>;
  }

  return (
    <Card title="Renovación rápida de medicación">
      {body}
    </Card>
  );
}
