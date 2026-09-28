import {
  MEDICAL_ORDER_PRIORITY_LABELS,
  MEDICAL_ORDER_SIGNATURE_DISCLAIMER,
} from "@/features/ordenes-medicas/constants";
import type { MedicalOrderDetail } from "@/features/ordenes-medicas/types";
import {
  categoryLabel,
  computeAge,
  describeItemMetadata,
  formatDateAr,
  formatDateTimeAr,
} from "@/features/ordenes-medicas/utils/medical-order-format";
import { buildPrescriptionQrImageUrl } from "@/features/recetas/utils/prescription-document-coverage";

import { type JsPdfDocument, loadJsPdf } from "@/lib/utils/jspdf-loader";

const PAGE_BOTTOM = 270;
const MARGIN_X = 18;
const CONTENT_WIDTH = 174;

function wrap(doc: JsPdfDocument, text: string, x: number, y: number, width: number, lh = 5): number {
  const lines = doc.splitTextToSize(text || "—", width) as string[];
  for (const line of lines) {
    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lh;
  }
  return y;
}

function section(doc: JsPdfDocument, title: string, y: number): number {
  if (y + 14 > PAGE_BOTTOM) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(203, 213, 225);
  doc.line(MARGIN_X, y - 3, MARGIN_X + CONTENT_WIDTH, y - 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(title.toUpperCase(), MARGIN_X, y + 2);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return y + 8;
}

function field(doc: JsPdfDocument, label: string, value: string | null | undefined, x: number, y: number, w: number): number {
  doc.setFont("helvetica", "bold");
  doc.text(`${label}: `, x, y);
  const lw = doc.getTextWidth(`${label}: `);
  doc.setFont("helvetica", "normal");
  return wrap(doc, value?.trim() || "—", x + lw, y, w - lw);
}

/** Builds the A4 medical order document (client-side, same jsPDF stack as prescriptions). */
export async function buildMedicalOrderPdf(order: MedicalOrderDetail, verifyUrl: string | null): Promise<JsPdfDocument> {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const patient = order.patient_snapshot ?? {};
  const issuer = order.issuer_snapshot ?? {};
  const isVoid = order.status === "void";

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  wrap(doc, issuer.clinic_name ?? "Consultorio", MARGIN_X, 18, 120, 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const clinicLines = [issuer.clinic_address, issuer.clinic_phone, issuer.clinic_email].filter(Boolean).join(" · ");
  if (clinicLines) wrap(doc, clinicLines, MARGIN_X, 24, 120, 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ORDEN MÉDICA", MARGIN_X + CONTENT_WIDTH, 18, { align: "right" });
  doc.setFontSize(10);
  doc.text(order.order_number ?? "BORRADOR", MARGIN_X + CONTENT_WIDTH, 24, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Emitida: ${formatDateTimeAr(order.issued_at)}`, MARGIN_X + CONTENT_WIDTH, 29, { align: "right" });
  if (order.valid_until) {
    doc.text(`Válida hasta: ${formatDateAr(order.valid_until)}`, MARGIN_X + CONTENT_WIDTH, 33, { align: "right" });
  }

  if (verifyUrl) {
    try {
      doc.addImage(buildPrescriptionQrImageUrl(verifyUrl, 160), "PNG", MARGIN_X + CONTENT_WIDTH - 28, 36, 28, 28);
      doc.setFontSize(7);
      doc.text("Verificar orden", MARGIN_X + CONTENT_WIDTH - 14, 67, { align: "center" });
    } catch {
      /* QR is optional in the document */
    }
  }

  let y = 44;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(categoryLabel(order.order_category), MARGIN_X, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  if (order.priority) {
    y = field(doc, "Prioridad", MEDICAL_ORDER_PRIORITY_LABELS[order.priority], MARGIN_X, y, 140);
  }
  y = Math.max(y + 4, 72);

  // Patient
  y = section(doc, "Paciente", y);
  const fullName = `${patient.last_name ?? ""}, ${patient.first_name ?? ""}`.replace(/^, |, $/g, "");
  const age = computeAge(patient.birth_date);
  const half = CONTENT_WIDTH / 2;
  const yA = field(doc, "Nombre", fullName || order.patient_name, MARGIN_X, y, half);
  const yB = field(doc, patient.document_type ?? "DNI", patient.document_number ?? order.patient_document, MARGIN_X + half, y, half);
  y = Math.max(yA, yB);
  const yC = field(
    doc,
    "Nacimiento",
    `${formatDateAr(patient.birth_date)}${age != null ? ` (${age} años)` : ""}`,
    MARGIN_X,
    y,
    half
  );
  const yD = field(doc, "Sexo", patient.sex, MARGIN_X + half, y, half);
  y = Math.max(yC, yD);
  const coverage = [patient.insurance_provider, patient.insurance_plan].filter(Boolean).join(" — ");
  const yE = field(doc, "Cobertura", coverage || "Particular", MARGIN_X, y, half);
  const yF = field(doc, "N.º afiliado", patient.insurance_number, MARGIN_X + half, y, half);
  y = Math.max(yE, yF) + 3;

  // Order
  y = section(doc, "Se solicita", y);
  order.items.forEach((item, idx) => {
    doc.setFont("helvetica", "bold");
    y = wrap(doc, `${idx + 1}. ${item.name}${item.code ? ` (${item.code})` : ""}`, MARGIN_X + 2, y, CONTENT_WIDTH - 2);
    doc.setFont("helvetica", "normal");
    for (const line of [...describeItemMetadata(item.metadata), item.description].filter(Boolean) as string[]) {
      y = wrap(doc, line, MARGIN_X + 7, y, CONTENT_WIDTH - 7);
    }
    y += 1;
  });
  if (order.items.length === 0) y = wrap(doc, order.order_text, MARGIN_X + 2, y, CONTENT_WIDTH - 2);
  y += 2;

  if (order.diagnosis_text || order.diagnosis_code) {
    y = field(
      doc,
      "Diagnóstico",
      [order.diagnosis_text, order.diagnosis_code ? `CIE-10 ${order.diagnosis_code}` : null].filter(Boolean).join(" · "),
      MARGIN_X,
      y,
      CONTENT_WIDTH
    );
  }
  if (order.clinical_indication) y = field(doc, "Indicación clínica", order.clinical_indication, MARGIN_X, y, CONTENT_WIDTH);
  if (order.preparation_instructions) {
    y = field(doc, "Preparación", order.preparation_instructions, MARGIN_X, y, CONTENT_WIDTH);
  }
  if (order.notes) y = field(doc, "Observaciones", order.notes, MARGIN_X, y, CONTENT_WIDTH);
  y += 4;

  // Professional
  y = section(doc, "Profesional", y);
  y = field(doc, "Nombre", issuer.full_name ?? order.professional_name, MARGIN_X, y, CONTENT_WIDTH);
  if (issuer.specialty) y = field(doc, "Especialidad", issuer.specialty, MARGIN_X, y, CONTENT_WIDTH);
  const licenses = [
    issuer.license_national ? `MN ${issuer.license_national}` : null,
    issuer.license_provincial
      ? `MP ${issuer.license_provincial}${issuer.licensing_jurisdiction ? ` (${issuer.licensing_jurisdiction})` : ""}`
      : null,
    !issuer.license_national && !issuer.license_provincial && issuer.license_number ? `Mat. ${issuer.license_number}` : null,
  ].filter(Boolean);
  y = field(doc, "Matrícula", licenses.join(" · ") || null, MARGIN_X, y, CONTENT_WIDTH);
  y += 14;
  doc.setDrawColor(100, 116, 139);
  doc.line(MARGIN_X + CONTENT_WIDTH - 70, y, MARGIN_X + CONTENT_WIDTH, y);
  doc.setFontSize(8);
  doc.text("Firma y sello", MARGIN_X + CONTENT_WIDTH - 35, y + 4, { align: "center" });

  // Void watermark
  if (isVoid) {
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setTextColor(220, 38, 38);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(64);
      doc.text("ANULADA", 105, 160, { align: "center", angle: 30 });
    }
    doc.setTextColor(15, 23, 42);
  }

  // Footer
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const footer = [
      MEDICAL_ORDER_SIGNATURE_DISCLAIMER,
      order.document_hash ? `Huella del documento (SHA-256): ${order.document_hash.slice(0, 32)}…` : null,
      isVoid ? `Anulada el ${formatDateTimeAr(order.voided_at)}` : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    const lines = doc.splitTextToSize(footer, CONTENT_WIDTH) as string[];
    lines.forEach((line, i) => doc.text(line, MARGIN_X, 282 + i * 3.5));
    doc.text(`Página ${p} de ${pages}`, MARGIN_X + CONTENT_WIDTH, 292, { align: "right" });
    doc.setTextColor(15, 23, 42);
  }

  return doc;
}

export function medicalOrderPdfFileName(order: Pick<MedicalOrderDetail, "order_number" | "id">): string {
  return `orden-medica-${order.order_number ?? order.id.slice(0, 8)}.pdf`;
}

export async function downloadMedicalOrderPdf(order: MedicalOrderDetail, verifyUrl: string | null): Promise<void> {
  const doc = await buildMedicalOrderPdf(order, verifyUrl);
  doc.save(medicalOrderPdfFileName(order));
}

export async function printMedicalOrderPdf(order: MedicalOrderDetail, verifyUrl: string | null): Promise<void> {
  const doc = await buildMedicalOrderPdf(order, verifyUrl);
  doc.autoPrint();
  const url = doc.output("bloburl") as unknown as string;
  const win = window.open(url, "_blank");
  if (!win) doc.save(medicalOrderPdfFileName(order));
}
