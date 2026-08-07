"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo, useState } from "react";

import type { HistoriaPrescriptionSummary } from "@/features/historias/types/historia-clinical-summaries";
import { PrescriptionDocumentActions } from "@/features/recetas/components/recetas/prescription-document-actions";
import { PrescriptionPreviewSheet } from "@/features/recetas/components/recetas/prescription-preview-sheet";
import type { PrescriptionsOrdersRecentPrescription } from "@/features/recetas/components/recetas/prescriptions-orders-types";
import { buildPrescriptionDocumentData } from "@/features/recetas/utils/build-prescription-document-data";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import { PRESCRIPTION_STATUS_LABELS } from "@/types/prescription";

type Props = {
  recentPrescriptions: PrescriptionsOrdersRecentPrescription[];
  clinic: { name: string; address?: string | null; phone?: string | null };
  onSelectPatient: (patientId: string) => void;
};

export function PrescriptionsOrdersRecentList({
  recentPrescriptions,
  clinic,
  onSelectPatient,
}: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewData = useMemo(() => {
    const rx = recentPrescriptions.find((item) => item.id === previewId);
    if (!rx) return null;
    return buildPrescriptionDocumentData(
      rx as HistoriaPrescriptionSummary,
      rx.patients,
      clinic,
      [rx.professionals]
    );
  }, [clinic, previewId, recentPrescriptions]);

  if (recentPrescriptions.length === 0) return null;

  return (
    <>
      <Card title="Recientes en el consultorio">
        <ul className="divide-y divide-slate-100">
          {recentPrescriptions.map((rx) => {
            const patient = rx.patients;
            const pro = rx.professionals;
            const documentData = buildPrescriptionDocumentData(
              rx as HistoriaPrescriptionSummary,
              patient,
              clinic,
              [pro]
            );

            return (
              <li
                key={rx.id}
                className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">
                      {rx.prescription_number ?? rx.id.slice(0, 8)}
                    </p>
                    <Badge
                      variant={
                        rx.status === "issued"
                          ? "success"
                          : rx.status === "void"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {PRESCRIPTION_STATUS_LABELS[rx.status]}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPatient(rx.patient_id)}
                    className="text-sm text-teal-700 hover:underline"
                  >
                    {patient.last_name}, {patient.first_name} — DNI {patient.document_number}
                  </button>
                  <p className="text-xs text-slate-500">
                    {getProfessionalDisplayName(pro)} ·{" "}
                    {format(new Date(rx.issued_at ?? rx.created_at), "PPp", { locale: es })}
                  </p>
                </div>
                {rx.status === "issued" ? (
                  <PrescriptionDocumentActions
                    compact
                    data={documentData}
                    onPreview={() => setPreviewId(rx.id)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {previewData ? (
        <PrescriptionPreviewSheet
          open={Boolean(previewId)}
          data={previewData}
          onClose={() => setPreviewId(null)}
        />
      ) : null}
    </>
  );
}
