"use client";

import { FileDown } from "lucide-react";

import type { InformedConsentRecord } from "@/core/compliance/informed-consent-types";
import {
  INFORMED_CONSENT_DECLARATION_PARAGRAPHS,
  INFORMED_CONSENT_DOCUMENT_VERSION,
} from "@/core/legal/informed-consent";

import { Button } from "@/components/ui/button";
import { loadJsPdf } from "@/lib/utils/jspdf-loader";

type PatientInfo = {
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
};

type ProfessionalInfo = {
  full_name: string;
  license_number?: string | null;
};

type ClinicInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
};

type Props = {
  consent: InformedConsentRecord;
  patient: PatientInfo;
  professional: ProfessionalInfo;
  clinic: ClinicInfo;
};

function wrapText(doc: import("@/lib/utils/jspdf-loader").JsPdfDocument, text: string, x: number, y: number, maxWidth: number, lineHeight = 5) {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  let cursor = y;
  for (const line of lines) {
    doc.text(line, x, cursor);
    cursor += lineHeight;
  }
  return cursor;
}

export function ExportInformedConsentPdfButton({
  consent,
  patient,
  professional,
  clinic,
}: Props) {
  async function exportPdf() {
    const jsPDF = await loadJsPdf();
    const doc = new jsPDF();
    const grantedAt = consent.grantedAt ?? consent.createdAt;
    let y = 18;

    doc.setFontSize(14);
    doc.text("CONSENTIMIENTO INFORMADO", 105, y, { align: "center" });
    y += 7;
    doc.setFontSize(9);
    doc.text(`Ley 26.529 · DrFlow · v${consent.documentVersion ?? INFORMED_CONSENT_DOCUMENT_VERSION}`, 105, y, {
      align: "center",
    });
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Consultorio", 20, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    y = wrapText(doc, clinic.name, 20, y, 170);
    if (clinic.address) y = wrapText(doc, clinic.address, 20, y, 170);
    if (clinic.phone) y = wrapText(doc, `Tel: ${clinic.phone}`, 20, y, 170);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.text("Paciente", 20, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    y = wrapText(
      doc,
      `${patient.last_name}, ${patient.first_name} · DNI ${patient.document_number}`,
      20,
      y,
      170
    );
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.text("Profesional", 20, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    y = wrapText(
      doc,
      `${professional.full_name}${professional.license_number ? ` · Mat. ${professional.license_number}` : ""}`,
      20,
      y,
      170
    );
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.text("Acto / procedimiento informado", 20, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    y = wrapText(doc, consent.procedureDescription ?? "—", 20, y, 170);
    y += 4;

    for (const paragraph of INFORMED_CONSENT_DECLARATION_PARAGRAPHS) {
      y = wrapText(doc, paragraph, 20, y, 170, 5);
      y += 2;
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
    }

    if (consent.notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Observaciones", 20, y);
      doc.setFont("helvetica", "normal");
      y += 5;
      y = wrapText(doc, consent.notes, 20, y, 170);
      y += 4;
    }

    y += 6;
    doc.text(`Fecha: ${new Date(grantedAt).toLocaleString("es-AR")}`, 20, y);
    y += 6;
    doc.text(`Acreditación: ${consent.signatureName ?? "—"}`, 20, y);
    y += 6;
    if (consent.recordedByName) {
      doc.text(`Registrado por: ${consent.recordedByName}`, 20, y);
    }

    doc.save(`consentimiento-${patient.document_number}-${consent.clinicalRecordId.slice(0, 8)}.pdf`);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void exportPdf()}>
      <FileDown className="h-4 w-4" aria-hidden />
      PDF consentimiento
    </Button>
  );
}
