"use client";

import { MessageCircle } from "lucide-react";
import { PatientWhatsAppButton } from "@/features/pacientes/components/patient-whatsapp-button";
import type { PatientPortalState } from "@/features/pacientes/hooks/use-patient-portal";

type Props = Pick<PatientPortalState, "doctorName" | "logWhatsappRequest"> & {
  clinicName: string;
  clinicPhone: string | null;
};

export function PatientPortalWhatsappScreen({
  doctorName,
  clinicName,
  clinicPhone,
  logWhatsappRequest,
}: Props) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
      <MessageCircle className="mx-auto h-14 w-14 text-[#25D366]" />
      <p className="text-sm text-slate-600">
        Escribile a {doctorName} por WhatsApp para turnos, recetas o consultas.
      </p>
      <PatientWhatsAppButton
        phone={clinicPhone}
        message={`Hola Dr/a. ${doctorName.split(" ").slice(-1)[0] ?? ""}, soy paciente. Quisiera pedir un turno.`}
        label="Pedir turno por WhatsApp"
        size="md"
        className="mx-auto w-full max-w-xs"
        onOpen={() => logWhatsappRequest("turno")}
      />
      <PatientWhatsAppButton
        phone={clinicPhone}
        message={`Hola, soy paciente de ${clinicName}. Tengo una consulta.`}
        label="Consulta general"
        size="md"
        className="mx-auto w-full max-w-xs"
        onOpen={() => logWhatsappRequest("consulta")}
      />
      {!clinicPhone ? (
        <p className="text-xs text-amber-700">El consultorio no tiene teléfono cargado.</p>
      ) : null}
    </div>
  );
}
