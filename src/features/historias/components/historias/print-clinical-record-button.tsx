"use client";

import { Printer } from "lucide-react";
import { useMemo } from "react";

import { toast } from "@/core/notifications/toast";

import type { HistoriaDetailProfessional } from "@/features/historias/server/load-historia-detail-page";
import { printEhrClinicalDocument } from "@/features/historias/utils/print-ehr-clinical-document";
import { formatAgeLabel } from "@/features/pacientes/utils/patient-age";
import { buildEhrPayloadFromRecords } from "@/features/pacientes/utils/patient-ehr-model";

import { Button } from "@/components/ui/button";

type ClinicalRecord = {
  id: string;
  created_at: string;
  professional_id: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  evolution: string | null;
  indications: string | null;
  professional_signature?: string | null;
};

type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  phone: string | null;
  email?: string | null;
};

type RecordProfessional = {
  license_national?: string | null;
  license_provincial?: string | null;
  license_number?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

interface Props {
  record: ClinicalRecord;
  patient: Patient;
  professional: RecordProfessional;
  professionalList?: HistoriaDetailProfessional[];
}

/** Imprime la consulta con layout Equipos en un documento aislado (sin UI de la app). */
export function PrintClinicalRecordButton({
  record,
  patient,
  professional,
  professionalList = [],
}: Props) {
  const patientInfo = useMemo(
    () => ({
      id: patient.id,
      first_name: patient.first_name,
      last_name: patient.last_name,
      document_number: patient.document_number,
      birth_date: patient.birth_date,
      age_label: formatAgeLabel(patient.birth_date),
      insurance_provider: patient.insurance_provider,
      insurance_number: patient.insurance_number,
      phone: patient.phone,
      email: patient.email,
    }),
    [patient]
  );

  const { consultations, diagnosisRows, treatmentRows } = useMemo(() => {
    const profile = professional.profiles;
    return buildEhrPayloadFromRecords([
      {
        id: record.id,
        created_at: record.created_at,
        chief_complaint: record.chief_complaint,
        diagnosis: record.diagnosis,
        evolution: record.evolution,
        indications: record.indications,
        professional_name: profile?.full_name?.trim() || "Profesional",
        professional_license_national:
          professional.license_national ?? professional.license_number ?? null,
        professional_license_provincial: professional.license_provincial ?? null,
        professional_email: profile?.email ?? null,
        professional_id: record.professional_id,
        professional_signature: record.professional_signature ?? null,
      },
    ]);
  }, [record, professional]);

  function handlePrint() {
    const result = printEhrClinicalDocument({
      scope: "all",
      patient: patientInfo,
      consultations,
      dayConsultations: consultations,
      diagnosisRows,
      treatmentRows,
      professionals: professionalList,
    });

    if (!result.ok) {
      toast.error(result.message);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4" aria-hidden />
      Imprimir historia clínica
    </Button>
  );
}
