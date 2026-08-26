import type { PrescriptionDocumentCoverage } from "@/features/recetas/utils/prescription-document-coverage";
import {
  buildPrescriptionQrImageUrl,
  formatPrescriptionCoverageLines,
} from "@/features/recetas/utils/prescription-document-coverage";

import {
  buildDocumentSignatureHtml,
  DOCUMENT_SIGNATURE_PRINT_STYLES,
} from "@/lib/utils/professional-signature-document";
import type { PrescriptionMedication, PrescriptionType } from "@/types/prescription";
import {
  ARGENTINA_PRESCRIPTION_DISCLAIMER,
  PRESCRIPTION_TYPE_LABELS,
} from "@/types/prescription";

export type PrescriptionDocumentData = {
  prescriptionId?: string;
  prescriptionNumber: string | null;
  prescriptionType: PrescriptionType;
  validityDays: number;
  status: string;
  issuedAt: string;
  diagnosisCie10: string | null;
  diagnosisText: string | null;
  medications: PrescriptionMedication[];
  notes: string | null;
  patientInsurance: string | null;
  coverage: PrescriptionDocumentCoverage;
  showQr: boolean;
  qrPayload: string | null;
  qrTitle?: string;
  qrHint?: string;
  refepsStatus?: string | null;
  refepsId?: string | null;
  nationalRxStatus?: string | null;
  cuirStatus?: string | null;
  cuirFormatted?: string | null;
  patient: {
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date?: string | null;
    sex?: string | null;
    cuil?: string | null;
    alt_identifier_type?: string | null;
    alt_identifier_value?: string | null;
    insurance_provider?: string | null;
    insurance_number?: string | null;
    address?: string | null;
  };
  professional: {
    full_name: string;
    license_number?: string | null;
    specialty?: string | null;
    profession?: string | null;
    jurisdiction?: string | null;
    refeps_identifier?: string | null;
    signatureText?: string | null;
    signatureImageUrl?: string | null;
  };
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMedicationsHtml(medications: PrescriptionMedication[]): string {
  if (medications.length === 0) {
    return `<p class="order-doc-empty">— Sin medicamentos —</p>`;
  }

  return medications
    .map((med, index) => {
      const detail = [med.presentation, med.concentration, med.route, `Cant: ${med.quantity}`]
        .filter(Boolean)
        .join(" · ");
      return `
        <div class="order-doc-med">
          <p class="order-doc-med-title">${index + 1}. ${escapeHtml(med.generic_name)}</p>
          ${med.brand_name ? `<p class="order-doc-med-line">Marca sugerida: ${escapeHtml(med.brand_name)}</p>` : ""}
          ${med.vademecum_code ? `<p class="order-doc-med-line">Cód. Alfabeta: ${escapeHtml(med.vademecum_code)}</p>` : ""}
          ${detail ? `<p class="order-doc-med-line">${escapeHtml(detail)}</p>` : ""}
          <p class="order-doc-med-line">Posología: ${escapeHtml(med.posology)}</p>
        </div>
      `;
    })
    .join("");
}

function buildCoverageHtml(coverage: PrescriptionDocumentCoverage): string {
  const lines = formatPrescriptionCoverageLines(coverage);
  if (lines.length === 0) return "";
  return `
    <section class="order-doc-block">
      <h2>Cobertura</h2>
      ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    </section>
  `;
}

function buildQrHtml(data: PrescriptionDocumentData): string {
  if (!data.showQr || !data.qrPayload) return "";
  const imgUrl = buildPrescriptionQrImageUrl(data.qrPayload);
  const title = data.qrTitle ?? "Verificación local";
  const hint =
    data.qrHint ?? "Placeholder DrFlow — no constituye trazabilidad REFEPS.";
  return `
    <section class="order-doc-block order-doc-qr">
      <h2>${escapeHtml(title)}</h2>
      <div class="order-doc-qr-row">
        <img src="${escapeHtml(imgUrl)}" width="100" height="100" alt="Código QR de verificación" />
        <div>
          <p class="order-doc-qr-code">${escapeHtml(data.qrPayload)}</p>
          ${data.refepsId ? `<p class="order-doc-qr-code"><strong>ID REFEPS:</strong> ${escapeHtml(data.refepsId)}</p>` : ""}
          ${
            data.cuirFormatted
              ? `<p class="order-doc-qr-code"><strong>CUIR:</strong> ${escapeHtml(data.cuirFormatted)}${
                  data.cuirStatus === "sandbox" ? " — SANDBOX — SIN VALIDEZ LEGAL" : ""
                }</p>`
              : ""
          }
          <p class="order-doc-qr-hint">${escapeHtml(hint)}</p>
        </div>
      </div>
    </section>
  `;
}

function buildCuirBlockHtml(data: PrescriptionDocumentData): string {
  if (!data.cuirFormatted?.trim()) return "";
  const sandbox = data.cuirStatus === "sandbox";
  const official = data.cuirStatus === "official";
  if (!sandbox && !official) return "";
  return `
    <section class="order-doc-block">
      <h2>${sandbox ? "CUIR SANDBOX — SIN VALIDEZ LEGAL" : "CUIR"}</h2>
      <p class="order-doc-qr-code">${escapeHtml(data.cuirFormatted)}</p>
      <p class="order-doc-qr-hint">${
        sandbox
          ? "Representación interna de prueba. No es el CUIR oficial numérico ni implica validación del Ministerio."
          : "CUIR oficial (concatenación numérica Anexo IV) tras validación estricta."
      }</p>
    </section>
  `;
}

export function buildPrescriptionDocumentHtml(data: PrescriptionDocumentData): string {
  const issued = new Date(data.issuedAt).toLocaleString("es-AR");
  const birth =
    data.patient.birth_date != null
      ? new Date(data.patient.birth_date).toLocaleDateString("es-AR")
      : null;
  const legacyInsurance =
    !formatPrescriptionCoverageLines(data.coverage).length &&
    (data.patientInsurance ||
      [data.patient.insurance_provider, data.patient.insurance_number].filter(Boolean).join(" — "));

  return `
    <article class="order-doc">
      <header class="order-doc-header">
        <p class="order-doc-kicker">República Argentina — DrFlow</p>
        <h1>RECETA LOCAL / BORRADOR</h1>
        <p class="order-doc-meta">
          N° ${escapeHtml(data.prescriptionNumber ?? "—")} · ${escapeHtml(issued)} ·
          ${escapeHtml(PRESCRIPTION_TYPE_LABELS[data.prescriptionType])} ·
          Vigencia ${data.validityDays} días
        </p>
      </header>

      <section class="order-doc-block">
        <h2>Establecimiento</h2>
        <p><strong>${escapeHtml(data.clinic.name)}</strong></p>
        ${data.clinic.address ? `<p>${escapeHtml(data.clinic.address)}</p>` : ""}
        ${data.clinic.phone ? `<p>Tel: ${escapeHtml(data.clinic.phone)}</p>` : ""}
      </section>

      <section class="order-doc-block">
        <h2>Paciente</h2>
        <p><strong>${escapeHtml(data.patient.last_name)}, ${escapeHtml(data.patient.first_name)}</strong></p>
        <p>DNI: ${escapeHtml(data.patient.document_number)}</p>
        ${data.patient.cuil ? `<p>CUIL: ${escapeHtml(data.patient.cuil)}</p>` : ""}
        ${
          !data.patient.cuil && data.patient.alt_identifier_value
            ? `<p>ID alternativo (${escapeHtml(data.patient.alt_identifier_type ?? "—")}): ${escapeHtml(data.patient.alt_identifier_value)}</p>`
            : ""
        }
        ${birth ? `<p>F. nac.: ${escapeHtml(birth)}</p>` : ""}
        ${data.patient.sex ? `<p>Sexo: ${escapeHtml(data.patient.sex)}</p>` : ""}
        ${data.patient.address ? `<p>Domicilio: ${escapeHtml(data.patient.address)}</p>` : ""}
        ${legacyInsurance ? `<p>Cobertura: ${escapeHtml(String(legacyInsurance))}</p>` : ""}
      </section>

      ${buildCoverageHtml(data.coverage)}

      <section class="order-doc-block">
        <h2>Prescriptor</h2>
        <p>Dr/a. ${escapeHtml(data.professional.full_name)}</p>
        ${data.professional.profession ? `<p>Profesión: ${escapeHtml(data.professional.profession)}</p>` : ""}
        ${data.professional.license_number ? `<p>Matrícula: ${escapeHtml(data.professional.license_number)}</p>` : ""}
        ${data.professional.jurisdiction ? `<p>Jurisdicción: ${escapeHtml(data.professional.jurisdiction)}</p>` : ""}
        ${data.professional.refeps_identifier ? `<p>REFEPS: ${escapeHtml(data.professional.refeps_identifier)}</p>` : ""}
        ${data.professional.specialty ? `<p>Especialidad: ${escapeHtml(data.professional.specialty)}</p>` : ""}
      </section>

      <section class="order-doc-block">
        <h2>Diagnóstico</h2>
        <p>CIE-10: ${escapeHtml(data.diagnosisCie10 ?? "—")}</p>
        <pre>${escapeHtml(data.diagnosisText?.trim() || "—")}</pre>
      </section>

      <section class="order-doc-block order-doc-body">
        <h2>Rp./</h2>
        ${buildMedicationsHtml(data.medications)}
      </section>

      ${
        data.notes?.trim()
          ? `<section class="order-doc-block"><h2>Observaciones</h2><pre>${escapeHtml(data.notes.trim())}</pre></section>`
          : ""
      }

      ${buildCuirBlockHtml(data)}

      ${buildDocumentSignatureHtml({
        signatureText: data.professional.signatureText,
        signatureImageUrl: data.professional.signatureImageUrl,
      })}

      ${buildQrHtml(data)}

      <footer class="order-doc-footer">
        <p>${escapeHtml(ARGENTINA_PRESCRIPTION_DISCLAIMER)}</p>
      </footer>
    </article>
  `;
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    color: #0f172a;
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.45;
    background: #ffffff;
  }
  .order-doc { max-width: 720px; margin: 0 auto; }
  .order-doc-header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 20px; }
  .order-doc-kicker { margin: 0 0 4px; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b; }
  .order-doc-header h1 { margin: 0; font-size: 22px; letter-spacing: 0.03em; color: #0f172a; }
  .order-doc-meta { margin: 8px 0 0; font-size: 12px; color: #475569; }
  .order-doc-block { margin-bottom: 18px; }
  .order-doc-block h2 {
    margin: 0 0 6px;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #0f766e;
  }
  .order-doc-block p { margin: 0 0 4px; font-size: 14px; color: #0f172a; }
  .order-doc-body pre,
  .order-doc-block pre {
    margin: 0;
    white-space: pre-wrap;
    font-family: inherit;
    font-size: 15px;
    line-height: 1.55;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #f8fafc;
    color: #0f172a;
  }
  .order-doc-med { margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #cbd5e1; }
  .order-doc-med:last-child { border-bottom: 0; margin-bottom: 0; padding-bottom: 0; }
  .order-doc-med-title { margin: 0 0 4px; font-size: 15px; font-weight: 700; }
  .order-doc-med-line { margin: 0 0 3px; font-size: 14px; color: #334155; }
  .order-doc-empty { margin: 0; font-size: 14px; color: #64748b; }
  .order-doc-qr-row { display: flex; gap: 16px; align-items: flex-start; }
  .order-doc-qr-code { margin: 0 0 4px; font-family: ui-monospace, monospace; font-size: 11px; word-break: break-all; }
  .order-doc-qr-hint { margin: 0; font-size: 10px; color: #64748b; }
  .order-doc-footer {
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    font-size: 10px;
    color: #64748b;
  }
  ${DOCUMENT_SIGNATURE_PRINT_STYLES}
`;

function buildPrintDocumentHtml(data: PrescriptionDocumentData): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" /><title>Receta local / borrador</title><style>${PRINT_STYLES}</style></head><body>${buildPrescriptionDocumentHtml(data)}</body></html>`;
}

function triggerPrint(targetWindow: Window): void {
  const print = () => {
    try {
      targetWindow.focus();
      targetWindow.print();
    } catch {
      /* popup may be blocked */
    }
  };
  if (targetWindow.document.readyState === "complete") {
    setTimeout(print, 150);
  } else {
    targetWindow.addEventListener("load", () => setTimeout(print, 150), { once: true });
  }
}

function printViaIframe(docHtml: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    return;
  }

  frameDoc.open();
  frameDoc.write(docHtml);
  frameDoc.close();
  triggerPrint(frameWindow);
  setTimeout(() => iframe.remove(), 2000);
}

export function printPrescriptionDocument(data: PrescriptionDocumentData): void {
  const docHtml = buildPrintDocumentHtml(data);
  const printWindow = window.open("about:blank", "_blank");

  if (!printWindow) {
    printViaIframe(docHtml);
    return;
  }

  printWindow.document.open();
  printWindow.document.write(docHtml);
  printWindow.document.close();
  triggerPrint(printWindow);
}
