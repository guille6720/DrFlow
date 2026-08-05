"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";
import type { PatientEhrConsultation } from "@/features/pacientes/utils/patient-ehr-model";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";
import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";

type Props = {
  open: boolean;
  patientId: string;
  record: PatientEhrConsultation | null;
  mode: "edit" | "view" | null;
  onClose: () => void;
};

function soapSection(label: string, value: string | null | undefined) {
  const text = sanitizeClinicalDisplayText(value);
  if (!text) return null;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{text}</p>
    </div>
  );
}

export function PatientRecordSheet({ open, patientId, record, mode, onClose }: Props) {
  if (!record) return null;

  const subjective = record.chief_complaint;
  const assessment = record.diagnosis;
  const plan = [record.indications, record.evolution].filter(Boolean).join("\n\n");

  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Consulta clínica"
      subtitle={format(new Date(record.created_at), "PPP '·' HH:mm", { locale: es })}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {record.professional_name ? (
          <p className="text-sm text-slate-500">Profesional: {record.professional_name}</p>
        ) : null}

        <div className="grid gap-3">
          {soapSection("Subjetivo (S)", subjective)}
          {soapSection("Evaluación (A)", assessment)}
          {soapSection("Plan (P)", plan || null)}
          {!subjective && !assessment && !plan ? (
            <p className="text-sm text-slate-500">Sin contenido clínico registrado.</p>
          ) : null}
        </div>

        {mode === "edit" ? (
          <Link href={`/historias/${record.id}/editar?from=historia&patient=${patientId}`}>
            <Button type="button" variant="outline" size="sm">
              Abrir editor completo
            </Button>
          </Link>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Link href={buildPatientWorkspaceUrl(patientId, { tab: "soap", record: record.id, mode: "edit" })}>
              <Button type="button" variant="outline" size="sm">
                Editar
              </Button>
            </Link>
            <Link href={`/historias/${record.id}?from=historia&patient=${patientId}`}>
              <Button type="button" variant="ghost" size="sm">
                Vista detallada
              </Button>
            </Link>
          </div>
        )}
      </div>
    </PatientWorkspaceOverlay>
  );
}
