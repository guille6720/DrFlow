"use client";

import { Button } from "@/components/ui/button";
import type { ElectronicPrescription, PrescriptionMedication } from "@/types/prescription";
import { Mail, MessageCircle } from "lucide-react";

interface PatientInfo {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
}

function buildPrescriptionSummary(
  prescription: ElectronicPrescription,
  patient: PatientInfo
): string {
  const meds = (prescription.medications as PrescriptionMedication[]) ?? [];
  const medLines = meds
    .map(
      (m, i) =>
        `${i + 1}. ${m.generic_name}${m.presentation ? ` (${m.presentation})` : ""} — ${m.posology}`
    )
    .join("\n");

  return [
    `Receta médica — ${patient.last_name}, ${patient.first_name}`,
    prescription.diagnosis_text ? `Diagnóstico: ${prescription.diagnosis_text}` : "",
    prescription.diagnosis_cie10 ? `CIE-10: ${prescription.diagnosis_cie10}` : "",
    "",
    "Medicamentos:",
    medLines,
    "",
    prescription.prescription_number
      ? `Nº ${prescription.prescription_number}`
      : "Generada en DrFlow",
  ]
    .filter(Boolean)
    .join("\n");
}

interface Props {
  prescription: ElectronicPrescription;
  patient: PatientInfo;
}

export function SharePrescriptionButtons({ prescription, patient }: Props) {
  const summary = buildPrescriptionSummary(prescription, patient);
  const subject = encodeURIComponent(
    `Receta — ${patient.last_name}, ${patient.first_name}`
  );
  const body = encodeURIComponent(summary);

  const phone = patient.phone?.replace(/\D/g, "");
  const whatsappUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`
    : `https://wa.me/?text=${encodeURIComponent(summary)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          window.location.href = `mailto:${patient.email ?? ""}?subject=${subject}&body=${body}`;
        }}
      >
        <Mail className="h-3.5 w-3.5" />
        Email
      </Button>
    </div>
  );
}
