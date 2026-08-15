import { escapeHtml } from "@/core/security/xss";

import {
  formatPrintBirthDate,
  formatPrintDetailedAge,
  formatPrintDocumentNumber,
  getIndicationsSnapshot,
  splitTreatmentProductLab,
} from "@/features/historias/components/historias/patient-ehr-print-utils";
import type { PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";
import { patientEhrEvolutionBody } from "@/features/historias/components/historias/patient-ehr-utils";
import {
  dedupeDiagnosisRows,
  dedupeTreatmentRows,
  diagnosesForConsultation,
  evolutionBodyWithoutExtractedBlocks,
  extractClinicalSection,
  formatCompactMatricula,
  formatPrintDateTime,
  formatPrintGeneratedAt,
  formatProfessionalLine,
  isActiveTreatmentStatus,
  parseVitalsFromText,
  treatmentsForConsultation,
} from "@/features/historias/utils/ehr-print-document-helpers";
import type { EhrPrintScope } from "@/features/historias/utils/ehr-print-mode";
import type { PatientProblemListItem } from "@/features/pacientes/server/load-clinical-structure";
import type {
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";

import type { ProfessionalSignatureSource } from "@/lib/utils/professional";
import {
  type DocumentSignature,
  resolveClinicalRecordDocumentSignature,
} from "@/lib/utils/professional-signature-document";

export type EhrPrintClinicalContext = {
  allergies?: string | null;
  medicalHistory?: string | null;
  regularMedication?: string | null;
  sexLabel?: string | null;
  problemList?: PatientProblemListItem[];
};

export type EhrPrintDocumentInput = {
  scope: EhrPrintScope;
  patient: PatientEhrPatientInfo;
  consultations: PatientEhrConsultation[];
  dayConsultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  professionals?: Array<ProfessionalSignatureSource & { id?: string }>;
  clinicalContext?: EhrPrintClinicalContext;
  generatedAt?: Date;
};

function evolutionText(consultation: PatientEhrConsultation): string {
  if (consultation.category === "document") {
    return consultation.diagnosis?.trim() || consultation.chief_complaint || "Documento adjunto";
  }
  if (consultation.category === "vitals") {
    return (
      consultation.evolution?.trim() ||
      consultation.chief_complaint?.trim() ||
      consultation.diagnosis?.trim() ||
      ""
    );
  }
  return patientEhrEvolutionBody(consultation);
}

function buildCompactSignatureHtml(
  consultation: PatientEhrConsultation,
  signature: DocumentSignature
): string {
  const name = consultation.professional_name.trim() || "Profesional";
  const titled = /^dr\.?\b|^dra\.?\b/i.test(name) ? name : `Dr/a. ${name}`;
  const matricula = formatCompactMatricula(consultation);
  const imageUrl = signature.signatureImageUrl?.trim();
  const imageHtml = imageUrl
    ? `<img class="sig-img" src="${escapeHtml(imageUrl)}" alt="" />`
    : "";

  return `
    <footer class="evo-sign">
      ${imageHtml}
      <p class="sig-name">${escapeHtml(titled)}</p>
      ${matricula ? `<p class="sig-mat">${escapeHtml(matricula)}</p>` : ""}
    </footer>`;
}

function renderVitalsTable(vitals: Record<string, string>): string {
  const entries = Object.entries(vitals);
  if (entries.length === 0) return "";
  const heads = entries.map(([key]) => `<th>${escapeHtml(key)}</th>`).join("");
  const values = entries.map(([, value]) => `<td>${escapeHtml(value)}</td>`).join("");
  return `
    <section class="block keep-with">
      <h3 class="block-title">Signos vitales</h3>
      <table class="vitals"><thead><tr>${heads}</tr></thead><tbody><tr>${values}</tr></tbody></table>
    </section>`;
}

function renderHeader(patient: PatientEhrPatientInfo, clinical: EhrPrintClinicalContext, generatedAt: string): string {
  const name = `${patient.last_name}, ${patient.first_name}`;
  const birth = formatPrintBirthDate(patient.birth_date);
  const age = formatPrintDetailedAge(patient.birth_date) ?? patient.age_label ?? null;
  const rows: Array<[string, string]> = [
    ["Paciente", name],
    ["DNI", formatPrintDocumentNumber(patient.document_number)],
  ];
  if (birth) rows.push(["Fecha de nacimiento", birth]);
  if (age) rows.push(["Edad", age]);
  if (clinical.sexLabel?.trim()) rows.push(["Sexo", clinical.sexLabel.trim()]);
  if (patient.insurance_provider?.trim()) {
    rows.push(["Cobertura", patient.insurance_provider.trim()]);
  }
  if (patient.insurance_number?.trim()) {
    rows.push(["N° afiliado", patient.insurance_number.trim()]);
  }
  if (patient.phone?.trim()) rows.push(["Teléfono", patient.phone.trim()]);
  if (patient.email?.trim()) rows.push(["Email", patient.email.trim()]);

  const cells = rows
    .map(
      ([label, value]) =>
        `<div class="meta-item"><span class="meta-label">${escapeHtml(label)}</span><span class="meta-value">${escapeHtml(value)}</span></div>`
    )
    .join("");

  return `
    <header class="doc-header">
      <div class="brand">
        <p class="brand-name">DRFLOW</p>
        <h1>Historia Clínica Completa</h1>
      </div>
      <p class="generated">Generado: ${escapeHtml(generatedAt)}</p>
      <div class="meta-grid">${cells}</div>
    </header>`;
}

function renderClinicalSummary(
  clinical: EhrPrintClinicalContext,
  diagnosisRows: PatientEhrDiagnosisRow[],
  treatmentRows: PatientEhrTreatmentRow[]
): string {
  const problems = clinical.problemList ?? [];
  const activeDx =
    problems.length > 0
      ? problems.map((item) => ({
          name: item.name,
          cie10: item.cie10_code,
          type: /cron/i.test(item.status) ? "Crónico" : item.status || "Activo",
          status: item.status,
        }))
      : dedupeDiagnosisRows(diagnosisRows)
          .filter((row) => row.chronic)
          .slice(0, 20)
          .map((row) => ({
            name: row.name,
            cie10: null as string | null,
            type: "Crónico",
            status: "Activo",
          }));

  const allergies = clinical.allergies?.trim();
  const history = clinical.medicalHistory?.trim();
  const activeTx = dedupeTreatmentRows(treatmentRows).filter((row) =>
    isActiveTreatmentStatus(row.status)
  );

  const dxRows =
    activeDx.length > 0
      ? activeDx
          .map(
            (item) => `<tr>
              <td>${escapeHtml(item.name)}</td>
              <td>${escapeHtml(item.cie10 ?? "—")}</td>
              <td>${escapeHtml(item.type)}</td>
              <td>${escapeHtml(item.status || "—")}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="4">Sin diagnósticos activos registrados</td></tr>`;

  const medRows =
    activeTx.length > 0
      ? activeTx
          .map((row) => {
            const { product, lab } = splitTreatmentProductLab(row.product);
            return `<tr>
              <td>${escapeHtml(product)}</td>
              <td>${escapeHtml(lab || "—")}</td>
              <td>${escapeHtml(row.dose !== "—" ? row.dose : "—")}</td>
              <td>${escapeHtml(row.frequency !== "—" ? row.frequency : "—")}</td>
            </tr>`;
          })
          .join("")
      : clinical.regularMedication?.trim()
        ? `<tr><td colspan="4">${escapeHtml(clinical.regularMedication.trim())}</td></tr>`
        : `<tr><td colspan="4">Sin medicación actual registrada</td></tr>`;

  return `
    <section class="summary keep-start">
      <h2 class="section-heading">Resumen clínico</h2>

      <h3 class="block-title">Diagnósticos activos</h3>
      <table class="data">
        <thead><tr><th>Diagnóstico</th><th>CIE-10</th><th>Tipo</th><th>Estado</th></tr></thead>
        <tbody>${dxRows}</tbody>
      </table>

      <h3 class="block-title">Antecedentes</h3>
      <p class="prose">${history ? escapeHtml(history) : "Sin antecedentes registrados"}</p>

      <div class="allergies ${allergies ? "allergies-alert" : ""}">
        <h3 class="block-title">Alergias</h3>
        <p class="prose">${allergies ? escapeHtml(allergies) : "Sin alergias registradas"}</p>
      </div>

      <h3 class="block-title">Medicación actual</h3>
      <table class="data">
        <thead><tr><th>Medicamento</th><th>Principio activo / lab.</th><th>Dosis</th><th>Frecuencia</th></tr></thead>
        <tbody>${medRows}</tbody>
      </table>
    </section>`;
}

function renderEvolutionBlock(
  consultation: PatientEhrConsultation,
  diagnosisRows: PatientEhrDiagnosisRow[],
  treatmentRows: PatientEhrTreatmentRow[],
  professionals: Array<ProfessionalSignatureSource & { id?: string }>
): string {
  const { date, time } = formatPrintDateTime(consultation.created_at);
  const rawBody = evolutionText(consultation);
  const vitals = parseVitalsFromText(
    [consultation.evolution, consultation.chief_complaint, consultation.diagnosis, rawBody]
      .filter(Boolean)
      .join("\n")
  );
  const labText =
    extractClinicalSection(rawBody, ["laboratorio", "lab", "análisis", "analisis"]) ||
    extractClinicalSection(consultation.indications, ["laboratorio", "lab"]);
  const studiesText =
    extractClinicalSection(rawBody, [
      "estudios complementarios",
      "estudios",
      "ecografía",
      "ecografia",
      "radiografía",
      "radiografia",
      "resonancia",
      "tomografía",
      "tomografia",
      "ecg",
      "electrocardiograma",
      "informe",
    ]) || extractClinicalSection(consultation.indications, ["estudios", "ecg", "rx"]);

  let body = evolutionBodyWithoutExtractedBlocks(rawBody);
  if (consultation.chief_complaint?.trim() && consultation.category === "evolution") {
    const cc = consultation.chief_complaint.trim();
    if (!body.includes(cc)) {
      body = `Motivo: ${cc}${body ? `\n\n${body}` : ""}`;
    }
  }

  const diagnoses = diagnosesForConsultation(consultation, diagnosisRows);
  const treatments = treatmentsForConsultation(consultation, treatmentRows);
  const indications = treatments.length === 0 ? getIndicationsSnapshot(consultation) : null;

  const dxHtml =
    diagnoses.length > 0
      ? `<section class="block keep-with"><h3 class="block-title">Diagnósticos</h3><ul class="bullets">${diagnoses
          .map(
            (item) =>
              `<li>${escapeHtml(item.name)}${item.cie10 ? ` — <span class="code">${escapeHtml(item.cie10)}</span>` : ""}${item.chronic ? ` <span class="tag">Crónico</span>` : ""}</li>`
          )
          .join("")}</ul></section>`
      : "";

  const txHtml =
    treatments.length > 0
      ? `<section class="block keep-with"><h3 class="block-title">Tratamiento / conducta</h3><ul class="bullets">${treatments
          .map((item) => {
            const details = [item.dose, item.frequency, item.notes].filter(Boolean).join(" · ");
            return `<li>${escapeHtml(item.product)}${details ? ` — ${escapeHtml(details)}` : ""}</li>`;
          })
          .join("")}</ul></section>`
      : indications
        ? `<section class="block keep-with"><h3 class="block-title">Tratamiento / conducta</h3><div class="prose">${escapeHtml(indications)}</div></section>`
        : "";

  const labHtml = labText
    ? `<section class="block keep-with"><h3 class="block-title">Laboratorio</h3><div class="prose">${escapeHtml(labText)}</div></section>`
    : "";
  const studiesHtml = studiesText
    ? `<section class="block keep-with"><h3 class="block-title">Estudios complementarios</h3><div class="prose">${escapeHtml(studiesText)}</div></section>`
    : "";

  const signature = resolveClinicalRecordDocumentSignature({
    professionalId: consultation.professional_id,
    storedSignatureText: consultation.professional_signature,
    professionals,
  });

  const showBody = body.trim().length > 0 && consultation.category !== "vitals";

  return `
    <article class="evolution">
      <header class="evo-head keep-with">
        <p class="evo-when">${escapeHtml(date)} — ${escapeHtml(time)}</p>
        <p class="evo-pro">${escapeHtml(formatProfessionalLine(consultation))}</p>
      </header>
      ${
        showBody
          ? `<section class="block keep-with"><h3 class="block-title">Evolución</h3><div class="prose">${escapeHtml(body)}</div></section>`
          : ""
      }
      ${dxHtml}
      ${txHtml}
      ${renderVitalsTable(vitals)}
      ${labHtml}
      ${studiesHtml}
      ${buildCompactSignatureHtml(consultation, signature)}
    </article>`;
}

function renderHistoricalDiagnoses(rows: PatientEhrDiagnosisRow[]): string {
  const deduped = dedupeDiagnosisRows(rows);
  if (deduped.length === 0) return "";
  const body = deduped
    .map((row) => {
      const { date } = formatPrintDateTime(row.recordCreatedAt);
      const parsed = splitDiagnosisName(row.name);
      return `<tr>
        <td>${escapeHtml(parsed.name)}</td>
        <td>${escapeHtml(parsed.cie10 ?? "—")}</td>
        <td>${row.chronic ? "Crónico" : "Agudo"}</td>
        <td>${escapeHtml(date)}</td>
        <td>${row.chronic ? "Activo" : "—"}</td>
      </tr>`;
    })
    .join("");

  return `
    <section class="appendix keep-start">
      <h2 class="section-heading">Diagnósticos</h2>
      <table class="data">
        <thead><tr><th>Diagnóstico</th><th>CIE-10</th><th>Tipo</th><th>Fecha desde</th><th>Estado</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
}

function splitDiagnosisName(name: string): { name: string; cie10: string | null } {
  const match = name.match(/^(.+?)\s+(?:\(CIE-10:\s*)?([A-Z]\d{2}(?:\.\d+)?|[A-Z]-\d{2,3})\)?$/i);
  if (match) {
    return { name: match[1].trim(), cie10: match[2].toUpperCase() };
  }
  return { name, cie10: null };
}

function renderHistoricalTreatments(rows: PatientEhrTreatmentRow[]): string {
  const deduped = dedupeTreatmentRows(rows);
  if (deduped.length === 0) return "";
  const body = deduped
    .map((row) => {
      const { product, lab } = splitTreatmentProductLab(row.product);
      const { date } = formatPrintDateTime(row.recordCreatedAt);
      const dose = row.dose !== "—" ? row.dose : "";
      const presentation = dose && /(caps|comp|ml|ui|jarabe|crema)/i.test(dose) ? dose : "—";
      return `<tr>
        <td>${escapeHtml(product)}</td>
        <td>${escapeHtml(lab || "—")}</td>
        <td>${escapeHtml(presentation)}</td>
        <td>${escapeHtml(dose || "—")}</td>
        <td>${escapeHtml(row.frequency !== "—" ? row.frequency : "—")}</td>
        <td>${escapeHtml(date)}</td>
        <td>—</td>
        <td>${escapeHtml(row.status || "—")}</td>
      </tr>`;
    })
    .join("");

  return `
    <section class="appendix keep-start">
      <h2 class="section-heading">Tratamientos y medicación</h2>
      <table class="data">
        <thead>
          <tr>
            <th>Medicamento</th>
            <th>Principio activo</th>
            <th>Presentación</th>
            <th>Dosis</th>
            <th>Frecuencia</th>
            <th>Fecha inicio</th>
            <th>Fecha fin</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
}

function printStyles(patientLabel: string, generatedAt: string): string {
  const safePatient = patientLabel.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeGenerated = generatedAt.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `
    @page {
      size: A4 portrait;
      margin: 16mm 15mm 18mm 15mm;
      @bottom-left {
        content: "DrFlow — Historia Clínica · ${safePatient}";
        font-size: 8pt;
        color: #64748b;
      }
      @bottom-right {
        content: "Página " counter(page) " · ${safeGenerated}";
        font-size: 8pt;
        color: #64748b;
      }
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0f172a;
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 10.5pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3, p, ul, table { margin: 0; }
    .doc-header { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1.5px solid #0f172a; }
    .brand-name {
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #1d4f91;
    }
    .doc-header h1 {
      margin-top: 2px;
      font-size: 16pt;
      font-weight: 700;
      color: #0f172a;
    }
    .generated { margin-top: 4px; font-size: 9pt; color: #64748b; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px 16px;
      margin-top: 10px;
    }
    .meta-item { display: flex; gap: 6px; font-size: 9.5pt; }
    .meta-label { min-width: 7.5rem; color: #64748b; font-weight: 600; }
    .meta-value { color: #0f172a; font-weight: 600; }
    .section-heading {
      margin: 14px 0 8px;
      font-size: 12.5pt;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 3px;
    }
    .block-title {
      margin: 8px 0 4px;
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #334155;
    }
    .prose { white-space: pre-wrap; font-size: 10.5pt; }
    .allergies { margin-top: 6px; padding: 6px 8px; border: 1px solid #e2e8f0; }
    .allergies-alert { border-color: #b91c1c; background: #fff5f5; }
    .allergies-alert .block-title { color: #991b1b; }
    table.data, table.vitals {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin-top: 4px;
    }
    table.data th, table.data td, table.vitals th, table.vitals td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      vertical-align: top;
      text-align: left;
    }
    table.data th, table.vitals th { background: #f8fafc; font-weight: 700; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .evolution {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #94a3b8;
    }
    .evo-head { margin-bottom: 6px; }
    .evo-when { font-size: 11pt; font-weight: 700; }
    .evo-pro { margin-top: 2px; font-size: 10pt; color: #1d4f91; font-weight: 600; }
    .block { margin-top: 6px; }
    .bullets { padding-left: 1.1rem; }
    .bullets li { margin: 2px 0; }
    .code { color: #475569; font-weight: 600; }
    .tag {
      display: inline-block;
      margin-left: 4px;
      padding: 0 4px;
      border: 1px solid #94a3b8;
      font-size: 8pt;
      color: #334155;
    }
    .evo-sign {
      margin-top: 8px;
      padding-top: 6px;
      max-width: 220px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .sig-img {
      display: block;
      max-width: 120px;
      max-height: 50px;
      width: auto;
      height: auto;
      object-fit: contain;
      margin-bottom: 2px;
    }
    .sig-name { font-size: 9.5pt; font-weight: 700; }
    .sig-mat { font-size: 9pt; color: #475569; }
    .keep-with { break-inside: avoid; page-break-inside: avoid; }
    .keep-start { break-before: auto; page-break-before: auto; }
    .evo-head { break-after: avoid; page-break-after: avoid; }
    .appendix { margin-top: 16px; }
    @media print {
      a[href]::after { content: none !important; }
    }
  `;
}

export function buildEhrPrintDocumentHtml(input: EhrPrintDocumentInput): string {
  const professionals = input.professionals ?? [];
  const clinical = input.clinicalContext ?? {};
  const generatedAtDate = input.generatedAt ?? new Date();
  const generatedAt = formatPrintGeneratedAt(generatedAtDate);
  const list = input.scope === "day" ? input.dayConsultations : input.consultations;
  const sorted = [...list].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const patientLabel = `${input.patient.last_name}, ${input.patient.first_name} — DNI ${formatPrintDocumentNumber(input.patient.document_number)}`;
  const summary =
    input.scope === "all"
      ? renderClinicalSummary(clinical, input.diagnosisRows, input.treatmentRows)
      : "";

  const evolutions = sorted
    .map((consultation) =>
      renderEvolutionBlock(consultation, input.diagnosisRows, input.treatmentRows, professionals)
    )
    .join("");

  const appendix =
    input.scope === "all"
      ? renderHistoricalDiagnoses(input.diagnosisRows) +
        renderHistoricalTreatments(input.treatmentRows)
      : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Historia_Clinica_${escapeHtml(input.patient.last_name)}_${escapeHtml(input.patient.first_name)}</title>
  <style>${printStyles(patientLabel, generatedAt)}</style>
</head>
<body>
  ${renderHeader(input.patient, clinical, generatedAt)}
  ${summary}
  <section class="evolutions">
    <h2 class="section-heading">Evoluciones</h2>
    ${evolutions || `<p class="prose">Sin evoluciones para el alcance seleccionado.</p>`}
  </section>
  ${appendix}
</body>
</html>`;
}
