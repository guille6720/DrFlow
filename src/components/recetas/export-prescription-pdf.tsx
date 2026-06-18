"use client";

import { jsPDF } from "jspdf";
import type { ElectronicPrescription, PrescriptionMedication } from "@/types/prescription";
import { ARGENTINA_PRESCRIPTION_DISCLAIMER, PRESCRIPTION_TYPE_LABELS } from "@/types/prescription";

interface PatientInfo {
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
}

interface ProfessionalInfo {
  full_name: string;
  license_number?: string | null;
  specialty?: string | null;
}

interface ClinicInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
}

interface Props {
  prescription: ElectronicPrescription;
  patient: PatientInfo;
  professional: ProfessionalInfo;
  clinic: ClinicInfo;
}

function meds(value: unknown): PrescriptionMedication[] {
  if (Array.isArray(value)) return value as PrescriptionMedication[];
  return [];
}

export function ExportPrescriptionPdfButton({
  prescription,
  patient,
  professional,
  clinic,
}: Props) {
  function exportPdf() {
    const doc = new jsPDF();
    const issued = prescription.issued_at ?? prescription.created_at;
    const medications = meds(prescription.medications);

    doc.setFontSize(14);
    doc.text("RECETA ELECTRÓNICA", 105, 18, { align: "center" });
    doc.setFontSize(9);
    doc.text("República Argentina — DrFlow", 105, 24, { align: "center" });

    doc.setFontSize(10);
    let y = 34;
    doc.text(`N° ${prescription.prescription_number ?? prescription.id.slice(0, 8)}`, 20, y);
    doc.text(`Fecha: ${new Date(issued).toLocaleString("es-AR")}`, 120, y);
    y += 8;
    doc.text(`Tipo: ${PRESCRIPTION_TYPE_LABELS[prescription.prescription_type]}`, 20, y);
    doc.text(`Vigencia: ${prescription.validity_days} días`, 120, y);

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Establecimiento", 20, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text(clinic.name, 20, y);
    if (clinic.address) {
      y += 5;
      doc.text(clinic.address, 20, y);
    }

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Paciente", 20, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text(`${patient.last_name}, ${patient.first_name}`, 20, y);
    y += 5;
    doc.text(`DNI: ${patient.document_number}`, 20, y);
    if (patient.birth_date) {
      y += 5;
      doc.text(`F. nac.: ${new Date(patient.birth_date).toLocaleDateString("es-AR")}`, 20, y);
    }
    if (prescription.patient_insurance) {
      y += 5;
      doc.text(`Cobertura: ${prescription.patient_insurance}`, 20, y);
    }

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Prescriptor", 20, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text(`Dr/a. ${professional.full_name}`, 20, y);
    if (professional.license_number) {
      y += 5;
      doc.text(`Matrícula: ${professional.license_number}`, 20, y);
    }
    if (professional.specialty) {
      y += 5;
      doc.text(`Especialidad: ${professional.specialty}`, 20, y);
    }

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Diagnóstico", 20, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text(`CIE-10: ${prescription.diagnosis_cie10 ?? "—"}`, 20, y);
    const diagLines = doc.splitTextToSize(prescription.diagnosis_text ?? "—", 170);
    doc.text(diagLines, 20, y + 5);
    y += diagLines.length * 5 + 10;

    doc.setFont("helvetica", "bold");
    doc.text("Rp./", 20, y);
    y += 8;

    medications.forEach((med, i) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. ${med.generic_name}`, 24, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      if (med.brand_name) {
        doc.text(`Marca sugerida: ${med.brand_name}`, 28, y);
        y += 5;
      }
      const detail = [
        med.presentation,
        med.concentration,
        `Cant: ${med.quantity}`,
        med.route,
      ]
        .filter(Boolean)
        .join(" · ");
      if (detail) {
        doc.text(detail, 28, y);
        y += 5;
      }
      const posology = doc.splitTextToSize(`Posología: ${med.posology}`, 160);
      doc.text(posology, 28, y);
      y += posology.length * 5 + 4;
    });

    if (prescription.notes) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.text("Observaciones", 20, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const noteLines = doc.splitTextToSize(prescription.notes, 170);
      doc.text(noteLines, 20, y);
      y += noteLines.length * 5;
    }

    y = Math.max(y + 10, 250);
    doc.setFontSize(7);
    const legal = doc.splitTextToSize(ARGENTINA_PRESCRIPTION_DISCLAIMER, 170);
    doc.text(legal, 20, y);

    doc.save(`receta-${prescription.prescription_number ?? patient.document_number}.pdf`);
  }

  return (
    <button
      type="button"
      onClick={exportPdf}
      className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-100"
    >
      Descargar PDF
    </button>
  );
}
