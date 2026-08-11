import {
  buildPrescriptionQrImageUrl,
  formatPrescriptionCoverageLines,
} from "@/features/recetas/utils/prescription-document-coverage";
import type { PrescriptionDocumentData } from "@/features/recetas/utils/print-prescription-document";

import { type JsPdfDocument, loadJsPdf } from "@/lib/utils/jspdf-loader";
import { resolvePdfImageDataUrl } from "@/lib/utils/pdf-image-data-url";
import type { PrescriptionMedication } from "@/types/prescription";
import {
  ARGENTINA_PRESCRIPTION_DISCLAIMER,
  PRESCRIPTION_TYPE_LABELS,
} from "@/types/prescription";

const PAGE_BOTTOM = 280;
const MARGIN_X = 20;
const CONTENT_WIDTH = 170;

function appendWrappedText(
  doc: JsPdfDocument,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 5
): number {
  const lines = doc.splitTextToSize(text || "—", maxWidth) as string[];
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function ensureSpace(doc: JsPdfDocument, y: number, needed: number): number {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    return 20;
  }
  return y;
}

function appendSectionTitle(doc: JsPdfDocument, title: string, y: number): number {
  y = ensureSpace(doc, y, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, MARGIN_X, y);
  return y + 6;
}

function appendMedications(doc: JsPdfDocument, medications: PrescriptionMedication[], y: number): number {
  y = appendSectionTitle(doc, "Rp./", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  medications.forEach((med, index) => {
    y = ensureSpace(doc, y, 24);
    doc.setFont("helvetica", "bold");
    y = appendWrappedText(doc, `${index + 1}. ${med.generic_name}`, MARGIN_X + 4, y, CONTENT_WIDTH - 4);
    doc.setFont("helvetica", "normal");
    if (med.brand_name) {
      y = appendWrappedText(doc, `Marca sugerida: ${med.brand_name}`, MARGIN_X + 8, y, CONTENT_WIDTH - 8);
    }
    if (med.vademecum_code) {
      y = appendWrappedText(
        doc,
        `Cód. Alfabeta: ${med.vademecum_code}`,
        MARGIN_X + 8,
        y,
        CONTENT_WIDTH - 8
      );
    }
    const detail = [med.presentation, med.concentration, med.route, `Cant: ${med.quantity}`]
      .filter(Boolean)
      .join(" · ");
    if (detail) {
      y = appendWrappedText(doc, detail, MARGIN_X + 8, y, CONTENT_WIDTH - 8);
    }
    y = appendWrappedText(doc, `Posología: ${med.posology}`, MARGIN_X + 8, y, CONTENT_WIDTH - 8);
    y += 4;
  });

  return y;
}

function appendCoverage(doc: JsPdfDocument, data: PrescriptionDocumentData, y: number): number {
  const lines = formatPrescriptionCoverageLines(data.coverage);
  if (lines.length === 0) return y;

  y = appendSectionTitle(doc, "Cobertura", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const line of lines) {
    y = ensureSpace(doc, y, 8);
    y = appendWrappedText(doc, line, MARGIN_X, y, CONTENT_WIDTH);
  }
  return y + 4;
}

async function appendSignatureAsync(
  doc: JsPdfDocument,
  data: PrescriptionDocumentData,
  y: number
): Promise<number> {
  const text = data.professional.signatureText?.trim();
  const imageUrl = data.professional.signatureImageUrl?.trim();
  if (!text && !imageUrl) return y;

  y = appendSectionTitle(doc, "Firma del profesional", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const pdfImageUrl = await resolvePdfImageDataUrl(imageUrl);
  if (pdfImageUrl) {
    y = ensureSpace(doc, y, 36);
    try {
      doc.addImage(pdfImageUrl, "PNG", MARGIN_X, y - 4, 50, 20);
      y += 24;
    } catch {
      /* ignore invalid image data */
    }
  }

  if (text) {
    y = ensureSpace(doc, y, 10);
    doc.setFont("helvetica", "bold");
    y = appendWrappedText(doc, text, MARGIN_X, y, CONTENT_WIDTH);
  }

  return y + 6;
}

function appendQr(doc: JsPdfDocument, data: PrescriptionDocumentData, y: number): number {
  if (!data.showQr || !data.qrPayload) return y;

  y = appendSectionTitle(doc, data.qrTitle ?? "Verificación local", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  y = ensureSpace(doc, y, 52);
  const qrUrl = buildPrescriptionQrImageUrl(data.qrPayload, 100);
  doc.addImage(qrUrl, "PNG", MARGIN_X, y, 28, 28);
  let textY = y + 4;
  doc.setFont("courier", "normal");
  textY = appendWrappedText(doc, data.qrPayload, MARGIN_X + 34, textY, CONTENT_WIDTH - 34, 4);
  if (data.refepsId) {
    textY = appendWrappedText(doc, `ID REFEPS: ${data.refepsId}`, MARGIN_X + 34, textY, CONTENT_WIDTH - 34, 4);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  if (data.qrHint) {
    textY = appendWrappedText(doc, data.qrHint, MARGIN_X + 34, textY, CONTENT_WIDTH - 34, 4);
  }

  return Math.max(y + 32, textY) + 6;
}

export async function downloadPrescriptionPdf(data: PrescriptionDocumentData): Promise<void> {
  const jsPDF = await loadJsPdf();
  const doc = new jsPDF();
  const issued = new Date(data.issuedAt).toLocaleString("es-AR");
  const birth =
    data.patient.birth_date != null
      ? new Date(data.patient.birth_date).toLocaleDateString("es-AR")
      : null;

  doc.setFontSize(14);
  doc.text("RECETA ELECTRÓNICA", 105, 18, { align: "center" });
  doc.setFontSize(9);
  doc.text("República Argentina — DrFlow", 105, 24, { align: "center" });

  doc.setFontSize(10);
  let y = 34;
  doc.text(`N° ${data.prescriptionNumber ?? "—"}`, MARGIN_X, y);
  doc.text(`Fecha: ${issued}`, 120, y);
  y += 8;
  doc.text(`Tipo: ${PRESCRIPTION_TYPE_LABELS[data.prescriptionType]}`, MARGIN_X, y);
  doc.text(`Vigencia: ${data.validityDays} días`, 120, y);

  y += 10;
  y = appendSectionTitle(doc, "Establecimiento", y);
  doc.setFont("helvetica", "normal");
  y = appendWrappedText(doc, data.clinic.name, MARGIN_X, y, CONTENT_WIDTH);
  if (data.clinic.address) {
    y = appendWrappedText(doc, data.clinic.address, MARGIN_X, y, CONTENT_WIDTH);
  }
  if (data.clinic.phone) {
    y = appendWrappedText(doc, `Tel: ${data.clinic.phone}`, MARGIN_X, y, CONTENT_WIDTH);
  }

  y += 4;
  y = appendSectionTitle(doc, "Paciente", y);
  doc.setFont("helvetica", "normal");
  y = appendWrappedText(
    doc,
    `${data.patient.last_name}, ${data.patient.first_name}`,
    MARGIN_X,
    y,
    CONTENT_WIDTH
  );
  y = appendWrappedText(doc, `DNI: ${data.patient.document_number}`, MARGIN_X, y, CONTENT_WIDTH);
  if (birth) {
    y = appendWrappedText(doc, `F. nac.: ${birth}`, MARGIN_X, y, CONTENT_WIDTH);
  }

  y = appendCoverage(doc, data, y);

  y = appendSectionTitle(doc, "Prescriptor", y);
  doc.setFont("helvetica", "normal");
  y = appendWrappedText(doc, `Dr/a. ${data.professional.full_name}`, MARGIN_X, y, CONTENT_WIDTH);
  if (data.professional.license_number) {
    y = appendWrappedText(doc, `Matrícula: ${data.professional.license_number}`, MARGIN_X, y, CONTENT_WIDTH);
  }
  if (data.professional.specialty) {
    y = appendWrappedText(doc, `Especialidad: ${data.professional.specialty}`, MARGIN_X, y, CONTENT_WIDTH);
  }

  y += 4;
  y = appendSectionTitle(doc, "Diagnóstico", y);
  doc.setFont("helvetica", "normal");
  y = appendWrappedText(doc, `CIE-10: ${data.diagnosisCie10 ?? "—"}`, MARGIN_X, y, CONTENT_WIDTH);
  y = appendWrappedText(doc, data.diagnosisText?.trim() || "—", MARGIN_X, y, CONTENT_WIDTH);

  y = appendMedications(doc, data.medications, y);

  if (data.notes?.trim()) {
    y = appendSectionTitle(doc, "Observaciones", y);
    doc.setFont("helvetica", "normal");
    y = appendWrappedText(doc, data.notes.trim(), MARGIN_X, y, CONTENT_WIDTH);
    y += 4;
  }

  y = await appendSignatureAsync(doc, data, y);
  y = appendQr(doc, data, y);

  y = ensureSpace(doc, y, 20);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  appendWrappedText(doc, ARGENTINA_PRESCRIPTION_DISCLAIMER, MARGIN_X, y, CONTENT_WIDTH, 4);

  const filename = `receta-${data.prescriptionNumber ?? data.patient.document_number}.pdf`;
  doc.save(filename);
}
