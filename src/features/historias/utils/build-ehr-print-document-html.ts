import { escapeHtml } from "@/core/security/xss";

import {
  formatPrintBirthDate,
  formatPrintDetailedAge,
  formatPrintDiagnosisMetaDate,
  formatPrintDocumentNumber,
  formatPrintHeaderDate,
  formatPrintTime,
  formatPrintTreatmentMetaDate,
  parseInlineDiagnoses,
  parseInlineTreatments,
  professionalMetaLine,
  splitTreatmentProductLab,
} from "@/features/historias/components/historias/patient-ehr-print-utils";
import type { PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";
import { patientEhrEvolutionBody } from "@/features/historias/components/historias/patient-ehr-utils";
import type { EhrPrintScope } from "@/features/historias/utils/ehr-print-mode";
import type {
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

export type EhrPrintDocumentInput = {
  scope: EhrPrintScope;
  patient: PatientEhrPatientInfo;
  consultations: PatientEhrConsultation[];
  dayConsultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
};

function tableDateLabel(dateLabel: string): string {
  return dateLabel.split("-").slice(0, 2).join("-");
}

function evolutionText(consultation: PatientEhrConsultation): string {
  if (consultation.category === "document") {
    return consultation.diagnosis?.trim() || consultation.chief_complaint || "Documento adjunto";
  }
  return patientEhrEvolutionBody(consultation);
}

function insuranceLabel(patient: PatientEhrPatientInfo): string {
  if (patient.insurance_provider?.toUpperCase().includes("PAMI")) return "PAMI";
  return patient.insurance_provider?.trim() || "Obra social";
}

function renderDemographics(patient: PatientEhrPatientInfo): string {
  const name = `${patient.last_name}, ${patient.first_name}`.toLowerCase();
  const birth = formatPrintBirthDate(patient.birth_date);
  const age = formatPrintDetailedAge(patient.birth_date) ?? patient.age_label ?? "Sin definir";
  const phone = patient.phone?.trim();

  return `
    <section class="demo">
      <div class="demo-grid">
        <div><p class="demo-label">Nombre</p><p class="demo-value demo-name">${escapeHtml(name)}</p></div>
        <div><p class="demo-label">DNI</p><p class="demo-value">${escapeHtml(formatPrintDocumentNumber(patient.document_number))}</p></div>
        <div><p class="demo-label">Edad</p><div class="demo-value">${birth ? `<p class="demo-birth">${escapeHtml(birth)}</p>` : ""}<p>${escapeHtml(age)}</p></div></div>
        <div><p class="demo-label">${escapeHtml(insuranceLabel(patient))}</p><p class="demo-value">${patient.insurance_number ? `# ${escapeHtml(patient.insurance_number)}` : "Sin definir"}</p></div>
        <div><p class="demo-label">Teléfono</p><p class="demo-value demo-phone">${phone ? escapeHtml(phone) : "Sin definir"}</p></div>
      </div>
    </section>`;
}

function renderEvolutionBlock(consultation: PatientEhrConsultation): string {
  const diagnoses = parseInlineDiagnoses(consultation);
  const treatments = parseInlineTreatments(consultation);
  const body = escapeHtml(evolutionText(consultation));

  const diagnosisHtml =
    diagnoses.length > 0
      ? `<section class="section"><h3 class="section-title">Diagnósticos</h3><ul class="diag-list">${diagnoses
          .map(
            (item) =>
              `<li><span>${escapeHtml(item.text)}</span>${item.code ? `<span class="diag-code">${escapeHtml(item.code)}</span>` : ""}</li>`
          )
          .join("")}</ul></section>`
      : "";

  const treatmentHtml =
    treatments.length > 0
      ? `<section class="section"><h3 class="section-title">Tratamientos</h3><ul class="treat-list">${treatments
          .map((item) => {
            return `<li><p class="treat-line"><strong>${escapeHtml(item.product)}</strong>${item.lab ? `<span class="treat-lab">${escapeHtml(item.lab)}</span>` : ""}</p>${item.dose ? `<p class="treat-dose">${escapeHtml(item.dose)}</p>` : ""}</li>`;
          })
          .join("")}</ul></section>`
      : "";

  return `
    <article class="evolution">
      <h2 class="evolution-title">${escapeHtml(formatPrintHeaderDate(consultation.created_at))} ${escapeHtml(consultation.professional_name)}</h2>
      <section class="section">
        <h3 class="section-title">Evoluciones</h3>
        <p class="meta">${escapeHtml(formatPrintTime(consultation.created_at))} ${escapeHtml(professionalMetaLine(consultation))}</p>
        <div class="evolution-body">${body}</div>
      </section>
      ${diagnosisHtml}
      ${treatmentHtml}
    </article>`;
}

function consultationForRecord(
  consultations: PatientEhrConsultation[],
  recordId: string
): PatientEhrConsultation | undefined {
  return consultations.find((item) => item.id === recordId);
}

function renderDiagnosisTable(
  rows: PatientEhrDiagnosisRow[],
  consultations: PatientEhrConsultation[]
): string {
  if (rows.length === 0) return "";

  const body = rows
    .map((row) => {
      const consultation = consultationForRecord(consultations, row.recordId);
      return `<tr>
        <td>${escapeHtml(tableDateLabel(row.dateLabel))}</td>
        <td>
          ${row.chronic ? `<p class="chronic">Crónico</p>` : ""}
          <p class="muted">${escapeHtml(consultation ? formatPrintDiagnosisMetaDate(consultation.created_at) : "")}</p>
          <p class="primary">${escapeHtml(row.name)}</p>
          ${consultation ? `<p class="pro-meta">${escapeHtml(professionalMetaLine(consultation))}</p>` : ""}
        </td>
      </tr>`;
    })
    .join("");

  return `
    <section class="table-section">
      <div class="table-caption">Diagnósticos</div>
      <table><thead><tr><th>Fecha</th><th>Nombre</th></tr></thead><tbody>${body}</tbody></table>
    </section>`;
}

function renderTreatmentTable(
  rows: PatientEhrTreatmentRow[],
  consultations: PatientEhrConsultation[]
): string {
  if (rows.length === 0) return "";

  const body = rows
    .map((row) => {
      const consultation = consultationForRecord(consultations, row.recordId);
      const { product, lab } = splitTreatmentProductLab(row.product);
      const presentation =
        row.dose && row.dose !== "—" && !row.product.includes(row.dose) ? row.dose : "";
      const notes = row.notes !== row.product && row.notes !== "—" ? row.notes : "";

      return `<tr>
        <td>${escapeHtml(tableDateLabel(row.dateLabel))}</td>
        <td>
          <p class="treat-line"><strong>${escapeHtml(product)}</strong>${lab ? `<span class="treat-lab">${escapeHtml(lab)}</span>` : ""}</p>
          ${presentation ? `<p class="muted">${escapeHtml(presentation)}</p>` : ""}
          ${consultation ? `<p class="pro-meta">${escapeHtml(professionalMetaLine(consultation))}</p>` : ""}
        </td>
        <td></td>
        <td>${row.frequency !== "—" ? escapeHtml(row.frequency) : ""}</td>
        <td>${notes ? escapeHtml(notes) : ""}</td>
        <td>
          <p class="status">${escapeHtml(row.status)}</p>
          <p class="muted">${escapeHtml(consultation ? formatPrintTreatmentMetaDate(consultation.created_at) : `${row.dateLabel} · (n/a)`)}</p>
        </td>
      </tr>`;
    })
    .join("");

  return `
    <section class="table-section">
      <div class="table-caption">Tratamientos</div>
      <table><thead><tr><th>Fecha</th><th>Producto</th><th>Dosis</th><th>Frecuencia</th><th>Notas</th><th>Estado</th></tr></thead><tbody>${body}</tbody></table>
    </section>`;
}

export function buildEhrPrintDocumentHtml(input: EhrPrintDocumentInput): string {
  const list = input.scope === "day" ? input.dayConsultations : input.consultations;
  const evolutions = list.map(renderEvolutionBlock).join("");
  const tables =
    input.scope === "all"
      ? renderDiagnosisTable(input.diagnosisRows, input.consultations) +
        renderTreatmentTable(input.treatmentRows, input.consultations)
      : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Historia clínica — ${escapeHtml(`${input.patient.last_name}, ${input.patient.first_name}`)}</title>
  <style>
    @page { size: A4; margin: 12mm 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #fff; font-size: 12px; }
    .demo { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1; }
    .demo-grid { display: grid; grid-template-columns: 1.6fr 0.9fr 1.1fr 1fr 1.2fr; gap: 8px 16px; }
    .demo-label { margin: 0; font-size: 11px; font-weight: 700; }
    .demo-value { margin: 2px 0 0; font-size: 12px; }
    .demo-name { color: #2563eb; text-transform: lowercase; }
    .demo-birth { margin: 0 0 2px; font-size: 10px; color: #64748b; }
    .demo-phone { color: #16a34a; }
    .evolution { padding: 10px 0; page-break-inside: avoid; }
    .evolution + .evolution { border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 12px; }
    .evolution-title { margin: 0 0 10px; font-size: 13px; font-weight: 700; }
    .section { margin-top: 10px; }
    .section-title { margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .meta { margin: 0 0 4px; font-size: 10px; color: #475569; }
    .evolution-body { white-space: pre-wrap; line-height: 1.45; font-size: 12px; }
    .diag-list, .treat-list { margin: 4px 0 0; padding: 0; list-style: none; }
    .diag-list li { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; padding-left: 12px; position: relative; }
    .diag-list li::before, .treat-list li::before { content: "•"; position: absolute; left: 0; }
    .diag-code { color: #64748b; white-space: nowrap; }
    .treat-list li { margin-bottom: 6px; padding-left: 12px; position: relative; }
    .treat-line { margin: 0; }
    .treat-line strong { text-transform: uppercase; }
    .treat-lab { margin-left: 4px; font-weight: 400; text-transform: none; }
    .treat-dose { margin: 2px 0 0; font-size: 10px; color: #64748b; }
    .table-section { margin-top: 20px; page-break-inside: avoid; }
    .table-caption { border: 1px solid #cbd5e1; border-bottom: none; background: #f8fafc; padding: 6px 8px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
    th { font-weight: 700; background: #fff; }
    .muted { margin: 0 0 2px; color: #475569; }
    .primary { margin: 0; font-weight: 600; }
    .chronic { margin: 0 0 2px; color: #2563eb; font-weight: 600; }
    .pro-meta { margin: 4px 0 0; color: #2563eb; }
    .status { margin: 0; color: #16a34a; font-weight: 600; }
  </style>
</head>
<body>
  ${renderDemographics(input.patient)}
  ${evolutions}
  ${tables}
</body>
</html>`;
}
