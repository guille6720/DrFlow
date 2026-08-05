"use client";

import { PatientWhatsAppButton } from "@/features/pacientes/components/pacientes/patient-whatsapp-button";
import type { PatientPortalState } from "@/features/pacientes/hooks/use-patient-portal";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = Pick<
  PatientPortalState,
  | "patientName"
  | "setPatientName"
  | "documentNumber"
  | "setDocumentNumber"
  | "insuranceNumber"
  | "setInsuranceNumber"
  | "medications"
  | "setMedications"
  | "recetaMessage"
  | "logWhatsappRequest"
> & {
  clinicPhone: string | null;
  offersPami: boolean;
};

export function PatientPortalRecetaScreen({
  offersPami,
  patientName,
  setPatientName,
  documentNumber,
  setDocumentNumber,
  insuranceNumber,
  setInsuranceNumber,
  medications,
  setMedications,
  recetaMessage,
  clinicPhone,
  logWhatsappRequest,
}: Props) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-600">
        {offersPami
          ? "Completá tus datos y enviá la solicitud de receta PAMI por WhatsApp."
          : "Completá tus datos y enviá la solicitud de receta por WhatsApp."}
      </p>
      <Input
        label="Nombre y apellido"
        value={patientName}
        onChange={(e) => setPatientName(e.target.value)}
        required
      />
      <Input
        label="DNI"
        value={documentNumber}
        onChange={(e) => setDocumentNumber(e.target.value)}
        required
      />
      <Input
        label={offersPami ? "N° beneficio PAMI (opcional)" : "N° afiliado (opcional)"}
        value={insuranceNumber}
        onChange={(e) => setInsuranceNumber(e.target.value)}
      />
      <Textarea
        label="Medicación a renovar"
        rows={4}
        value={medications}
        onChange={(e) => setMedications(e.target.value)}
        placeholder="Ej: Enalapril 10 mg, Metformina 850 mg..."
        required
      />
      <PatientWhatsAppButton
        phone={clinicPhone}
        message={recetaMessage}
        label="Enviar solicitud por WhatsApp"
        size="md"
        className="w-full"
        onOpen={() => logWhatsappRequest("receta")}
      />
    </div>
  );
}
