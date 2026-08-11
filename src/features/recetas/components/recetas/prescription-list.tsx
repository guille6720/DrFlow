"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye, Pill, Printer, RefreshCw } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { cn } from "@/shared/utils/cn";

import type { HistoriaPrescriptionSummary } from "@/features/historias/types/historia-clinical-summaries";
import { PrescriptionDocumentActions } from "@/features/recetas/components/recetas/prescription-document-actions";
import { PrescriptionPreviewSheet } from "@/features/recetas/components/recetas/prescription-preview-sheet";
import { PrescriptionRefepsActions } from "@/features/recetas/components/recetas/prescription-refeps-actions";
import { buildPrescriptionDocumentData } from "@/features/recetas/utils/build-prescription-document-data";
import type { CoverageRuleOverridesMap } from "@/features/recetas/utils/coverage-rules-admin";
import { printPrescriptionDocument } from "@/features/recetas/utils/print-prescription-document";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PrescriptionMedication } from "@/types/prescription";
import { PRESCRIPTION_TYPE_LABELS, resolvePrescriptionDisplayStatus } from "@/types/prescription";

type PatientInfo = {
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
};

type ProfessionalInfo = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  profiles?: { full_name?: string | null } | null;
  specialties?: { name?: string | null } | { name?: string | null }[] | null;
};

type ClinicInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
};

type Props = {
  prescriptions: HistoriaPrescriptionSummary[];
  patient: PatientInfo;
  clinic: ClinicInfo;
  professionals: ProfessionalInfo[];
  canIssue?: boolean;
  actingId?: string | null;
  onIssue?: (id: string) => void;
  onVoid?: (id: string) => void;
  onMarkDispensed?: (id: string) => void;
  onReuseMedications?: (prescription: HistoriaPrescriptionSummary) => void;
  shareSlot?: (prescription: HistoriaPrescriptionSummary) => ReactNode;
  coverageRuleOverrides?: CoverageRuleOverridesMap | null;
  refepsEnabled?: boolean;
};

function displayStatus(rx: HistoriaPrescriptionSummary): string {
  return resolvePrescriptionDisplayStatus({
    status: rx.status,
    dispensed_at: rx.dispensed_at ?? null,
  });
}

function statusVariant(rx: HistoriaPrescriptionSummary): "default" | "success" | "warning" | "danger" {
  if (rx.status === "issued" && rx.dispensed_at) return "default";
  if (rx.status === "issued") return "success";
  if (rx.status === "void") return "danger";
  return "warning";
}

function medsSummary(medications: PrescriptionMedication[]): string {
  if (medications.length === 0) return "Sin medicamentos";
  const first = medications[0]?.generic_name ?? "Medicamento";
  return medications.length > 1 ? `${first} +${medications.length - 1}` : first;
}

export function PrescriptionList({
  prescriptions,
  patient,
  clinic,
  professionals,
  canIssue = false,
  actingId = null,
  onIssue,
  onVoid,
  onMarkDispensed,
  onReuseMedications,
  shareSlot,
  coverageRuleOverrides = null,
  refepsEnabled = false,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    prescriptions.find((rx) => rx.status === "issued")?.id ?? prescriptions[0]?.id ?? null
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  const documentsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildPrescriptionDocumentData>>();
    for (const rx of prescriptions) {
      map.set(
        rx.id,
        buildPrescriptionDocumentData(rx, patient, clinic, professionals, {
          coverageRuleOverrides,
        })
      );
    }
    return map;
  }, [clinic, coverageRuleOverrides, patient, prescriptions, professionals]);

  const selectedDocument = selectedId ? documentsById.get(selectedId) ?? null : null;

  function openPreview(id: string) {
    setSelectedId(id);
    setPreviewOpen(true);
  }

  if (prescriptions.length === 0) {
    return <p className="text-sm text-slate-500">No hay recetas para mostrar.</p>;
  }

  return (
    <>
      {selectedDocument && selectedDocument.status === "issued" ? (
        <div className="drflow-medical-order-toolbar mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/90 px-3 py-2">
          <p className="min-w-0 flex-1 text-sm font-medium text-blue-950">
            Receta seleccionada — {selectedDocument.prescriptionNumber ?? "Sin número"}
          </p>
          <button
            type="button"
            className="drflow-medical-order-action-btn inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-100"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Vista previa
          </button>
          <button
            type="button"
            className="drflow-medical-order-action-btn inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => printPrescriptionDocument(selectedDocument)}
          >
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir seleccionada
          </button>
        </div>
      ) : null}

      <ul className="space-y-3 text-sm">
        {prescriptions.map((rx) => {
          const documentData = documentsById.get(rx.id)!;
          const medications = Array.isArray(rx.medications)
            ? (rx.medications as PrescriptionMedication[])
            : [];
          const isVoid = rx.status === "void";
          const isIssued = rx.status === "issued";
          const isSelected = selectedId === rx.id;

          return (
            <li
              key={rx.id}
              className={cn(
                "drflow-medical-order-row rounded-lg border transition",
                isSelected
                  ? "border-blue-400 bg-blue-50/70 ring-2 ring-blue-300"
                  : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 p-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(rx.id);
                    if (isVoid) return;
                    if (isIssued) openPreview(rx.id);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      {rx.prescription_number ?? rx.id.slice(0, 8)}
                    </span>
                    <Badge variant={statusVariant(rx)}>
                      {displayStatus(rx)}
                    </Badge>
                    {medications.length > 0 ? (
                      <Badge variant="default">{medications.length} med.</Badge>
                    ) : null}
                    {isIssued && rx.refeps_status && rx.refeps_status !== "local" ? (
                      <Badge
                        variant={
                          rx.refeps_status === "submitted"
                            ? "success"
                            : rx.refeps_status === "failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {rx.refeps_status === "submitted" && rx.refeps_id
                          ? rx.refeps_id
                          : rx.refeps_status}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {format(new Date(rx.issued_at ?? rx.created_at), "PPp", { locale: es })}
                    {rx.diagnosis_cie10 ? ` · CIE-10 ${rx.diagnosis_cie10}` : ""}
                    {rx.patient_insurance ? ` · ${rx.patient_insurance}` : ""}
                    {rx.coverage_kind ? ` (${rx.coverage_kind})` : ""}
                  </p>
                  {rx.prescription_type ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {PRESCRIPTION_TYPE_LABELS[rx.prescription_type]}
                      {rx.validity_days ? ` · vigencia ${rx.validity_days} días` : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 line-clamp-2 text-slate-800">
                    {rx.diagnosis_text?.trim() || "—"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    Rp./ {medsSummary(medications)}
                  </p>
                  {isIssued && !isVoid ? (
                    <p className="mt-2 text-xs font-medium text-blue-700">
                      Clic para vista previa · Usá los botones para imprimir
                    </p>
                  ) : null}
                </button>

                <div className="flex flex-col items-stretch gap-2">
                  {isIssued && !isVoid ? (
                    <>
                      <PrescriptionDocumentActions
                        compact
                        data={documentData}
                        onPreview={() => openPreview(rx.id)}
                      />
                      <PrescriptionRefepsActions
                        compact
                        prescriptionId={rx.id}
                        refepsStatus={rx.refeps_status}
                        refepsId={rx.refeps_id}
                        refepsError={rx.refeps_error}
                        refepsEnabled={refepsEnabled}
                      />
                      {shareSlot?.(rx)}
                    </>
                  ) : null}
                  {isIssued && !isVoid && onReuseMedications && medications.length > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReuseMedications(rx)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reutilizar meds
                    </Button>
                  ) : null}
                  {isIssued && !isVoid && !rx.dispensed_at && onMarkDispensed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={actingId === rx.id}
                      onClick={() => onMarkDispensed(rx.id)}
                    >
                      <Pill className="h-4 w-4" />
                      Marcar dispensada
                    </Button>
                  ) : null}
                  {canIssue && rx.status === "draft" && onIssue ? (
                    <Button size="sm" loading={actingId === rx.id} onClick={() => onIssue(rx.id)}>
                      Emitir
                    </Button>
                  ) : null}
                  {canIssue && rx.status !== "void" && onVoid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={actingId === rx.id}
                      onClick={() => onVoid(rx.id)}
                    >
                      Anular
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {selectedDocument ? (
        <PrescriptionPreviewSheet
          open={previewOpen}
          data={selectedDocument}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
