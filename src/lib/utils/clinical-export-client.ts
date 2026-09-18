"use client";

import { toCsvDocument } from "@/features/integraciones/lib/spreadsheet-export-safety";

import { buildClinicalHistoryFilename } from "@/lib/utils/clinical-history-filename";
import { type JsPdfDocument, loadJsPdf } from "@/lib/utils/jspdf-loader";

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = toCsvDocument(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ClinicalRecordExportRow = {
  created_at: string;
  patient_name: string;
  document_number: string;
  professional_name: string;
  chief_complaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
};

export type PatientExportRow = {
  last_name: string;
  first_name: string;
  document_number: string;
  phone: string;
  email: string;
  insurance_provider: string;
  birth_date: string;
};

export function downloadClinicalRecordsCsv(filename: string, records: ClinicalRecordExportRow[]) {
  const header = [
    "fecha",
    "paciente",
    "dni",
    "profesional",
    "motivo",
    "diagnostico",
    "evolucion",
    "indicaciones",
  ];
  const rows = records.map((r) => [
    r.created_at,
    r.patient_name,
    r.document_number,
    r.professional_name,
    r.chief_complaint,
    r.diagnosis,
    r.evolution,
    r.indications,
  ]);
  downloadCsv(filename, [header, ...rows]);
}

export function downloadPatientsCsv(filename: string, patients: PatientExportRow[]) {
  const header = ["apellido", "nombre", "dni", "telefono", "email", "obra_social", "fecha_nacimiento"];
  const rows = patients.map((p) => [
    p.last_name,
    p.first_name,
    p.document_number,
    p.phone,
    p.email,
    p.insurance_provider,
    p.birth_date,
  ]);
  downloadCsv(filename, [header, ...rows]);
}

function appendWrappedText(
  doc: JsPdfDocument,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const lines = doc.splitTextToSize(text || "—", maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export async function downloadClinicalHistoryPdf(
  patient: { first_name: string; last_name: string; document_number: string },
  records: ClinicalRecordExportRow[]
) {
  const jsPDF = await loadJsPdf();
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("NexClinic — Historia clínica", 20, 20);
  doc.setFontSize(11);
  doc.text(`Paciente: ${patient.last_name}, ${patient.first_name}`, 20, 32);
  doc.text(`DNI: ${patient.document_number}`, 20, 40);
  doc.text(`Consultas: ${records.length}`, 20, 48);

  let y = 58;
  for (const record of records) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.text(new Date(record.created_at).toLocaleString("es-AR"), 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Profesional: ${record.professional_name}`, 20, y);
    y += 8;
    y = appendWrappedText(doc, `Motivo: ${record.chief_complaint}`, 20, y, 170, 5);
    y = appendWrappedText(doc, `Diagnóstico: ${record.diagnosis}`, 20, y, 170, 5);
    y = appendWrappedText(doc, `Evolución: ${record.evolution}`, 20, y, 170, 5);
    y = appendWrappedText(doc, `Indicaciones: ${record.indications}`, 20, y, 170, 5);
    y += 10;
  }

  doc.save(
    buildClinicalHistoryFilename({
      last_name: patient.last_name,
      first_name: patient.first_name,
      document_number: patient.document_number,
      consultationDate: records[0]?.created_at ?? null,
    })
  );
}

export async function downloadPatientsPdf(patients: PatientExportRow[]) {
  const jsPDF = await loadJsPdf();
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("NexClinic — Listado de pacientes", 20, 20);
  doc.setFontSize(10);
  let y = 32;
  for (const p of patients) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const line = `${p.last_name}, ${p.first_name} · DNI ${p.document_number} · ${p.phone || p.email || "—"} · ${p.insurance_provider || "—"}`;
    const lines = doc.splitTextToSize(line, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 4;
  }
  doc.save("pacientes-drflow.pdf");
}

export async function downloadClinicalRecordsListPdf(records: ClinicalRecordExportRow[], title: string) {
  const jsPDF = await loadJsPdf();
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("NexClinic — Consultas clínicas", 20, 20);
  doc.setFontSize(11);
  doc.text(title, 20, 30);
  let y = 40;
  for (const r of records) {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    const head = `${new Date(r.created_at).toLocaleDateString("es-AR")} · ${r.patient_name} · ${r.professional_name}`;
    doc.setFont("helvetica", "bold");
    doc.text(head, 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    y = appendWrappedText(doc, r.diagnosis || r.chief_complaint, 20, y, 170, 5);
    y += 6;
  }
  doc.save("consultas-clinicas-drflow.pdf");
}
