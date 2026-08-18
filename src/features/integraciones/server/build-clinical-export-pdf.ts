import "server-only";

import type { ClinicalExportSnapshot } from "@/features/integraciones/lib/clinical-export-package";

import { loadJsPdf } from "@/lib/utils/jspdf-loader";

function appendWrapped(
  doc: InstanceType<Awaited<ReturnType<typeof loadJsPdf>>>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const lines = doc.splitTextToSize(text || "—", maxWidth) as string[];
  const pageHeight = doc.internal.pageSize.getHeight();
  for (const line of lines) {
    if (y > pageHeight - 18) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

export async function buildClinicalExportPdf(snapshot: ClinicalExportSnapshot): Promise<Buffer> {
  const jsPDF = await loadJsPdf();
  const doc = new jsPDF();
  const patient = snapshot.patient;

  doc.setFontSize(16);
  doc.text("DrFlow — Historia clinica", 20, 20);
  doc.setFontSize(11);
  let y = 32;
  y = appendWrapped(
    doc,
    `Paciente: ${patient.last_name}, ${patient.first_name} · DNI ${patient.document_number}`,
    20,
    y,
    170,
    6
  );
  if (patient.birth_date) y = appendWrapped(doc, `Nacimiento: ${patient.birth_date}`, 20, y, 170, 6);
  if (snapshot.allergies) y = appendWrapped(doc, `Alergias: ${snapshot.allergies}`, 20, y, 170, 6);
  if (snapshot.medical_history) {
    y = appendWrapped(doc, `Antecedentes: ${snapshot.medical_history}`, 20, y, 170, 6);
  }
  y += 4;

  for (const record of snapshot.consultations) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    y = appendWrapped(doc, record.date, 20, y, 170, 6);
    doc.setFont("helvetica", "normal");
    y = appendWrapped(doc, `Profesional: ${record.professional_name}`, 20, y, 170, 5);
    y = appendWrapped(doc, `Motivo: ${record.chief_complaint}`, 20, y, 170, 5);
    y = appendWrapped(doc, `Diagnostico: ${record.diagnosis}`, 20, y, 170, 5);
    y = appendWrapped(doc, `Evolucion: ${record.evolution}`, 20, y, 170, 5);
    y = appendWrapped(doc, `Indicaciones: ${record.indications}`, 20, y, 170, 5);
    y += 8;
  }

  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}
