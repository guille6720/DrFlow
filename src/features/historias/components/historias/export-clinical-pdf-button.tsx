"use client";

import { Button } from "@/components/ui/button";
import { loadJsPdf } from "@/lib/utils/jspdf-loader";
import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";

interface Props {
  record: {
    chief_complaint: string | null;
    diagnosis: string | null;
    evolution: string | null;
    indications: string | null;
    professional_signature: string | null;
    created_at: string;
  };
  patient: { first_name: string; last_name: string; document_number: string };
  professional: { profiles: { full_name: string } | null };
}

export function ExportClinicalPdfButton({ record, patient, professional }: Props) {
  async function exportPdf() {
    const jsPDF = await loadJsPdf();
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("DrFlow — Resumen clínico", 20, 20);
    doc.setFontSize(10);
    doc.text(`Paciente: ${patient.last_name}, ${patient.first_name}`, 20, 35);
    doc.text(`DNI: ${patient.document_number}`, 20, 42);
    doc.text(`Profesional: ${professional?.profiles?.full_name ?? "—"}`, 20, 49);
    doc.text(`Fecha: ${new Date(record.created_at).toLocaleString("es-AR")}`, 20, 56);

    let y = 70;
    const sections = [
      ["Motivo de consulta", sanitizeClinicalDisplayText(record.chief_complaint)],
      ["Diagnóstico", sanitizeClinicalDisplayText(record.diagnosis)],
      ["Evolución", sanitizeClinicalDisplayText(record.evolution)],
      ["Indicaciones", sanitizeClinicalDisplayText(record.indications)],
    ] as const;

    for (const [title, content] of sections) {
      doc.setFont("helvetica", "bold");
      doc.text(title, 20, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(content ?? "—", 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 8;
    }

    if (record.professional_signature) {
      doc.text(`Firma: ${record.professional_signature}`, 20, y);
    }

    doc.save(`consulta-${patient.document_number}.pdf`);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void exportPdf()}>
      Exportar PDF
    </Button>
  );
}
