"use client";

import { Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PatientEhrPrintClinicalTables } from "@/features/historias/components/historias/patient-ehr-print-clinical-tables";
import { PatientEhrPrintDemographics } from "@/features/historias/components/historias/patient-ehr-print-demographics";
import { PatientEhrPrintEvolutionBlock } from "@/features/historias/components/historias/patient-ehr-print-evolution-block";
import type { PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";
import { formatAgeLabel } from "@/features/pacientes/utils/patient-age";
import { buildEhrPayloadFromRecords } from "@/features/pacientes/utils/patient-ehr-model";

import { Button } from "@/components/ui/button";

type ClinicalRecord = {
  id: string;
  created_at: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  evolution: string | null;
  indications: string | null;
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
}

/** Imprime la consulta con layout Equipos (misma salida que HC del paciente). */
export function PrintClinicalRecordButton({ record, patient, professional }: Props) {
  const [printing, setPrinting] = useState(false);

  const patientInfo: PatientEhrPatientInfo = useMemo(
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
      },
    ]);
  }, [record, professional]);

  useEffect(() => {
    if (!printing) return;
    function clearPrinting() {
      setPrinting(false);
    }
    window.addEventListener("afterprint", clearPrinting);
    return () => window.removeEventListener("afterprint", clearPrinting);
  }, [printing]);

  function handlePrint() {
    setPrinting(true);
    requestAnimationFrame(() => {
      window.print();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4" aria-hidden />
        Imprimir
      </Button>

      <div
        className="drflow-clinical-record-print-host"
        data-active={printing ? "true" : undefined}
        aria-hidden={!printing}
      >
        <div className="drflow-ehr-shell" data-print-scope={printing ? "all" : undefined}>
          <div className="drflow-ehr-print-demographics-wrap">
            <PatientEhrPrintDemographics patient={patientInfo} />
          </div>
          <div className="drflow-ehr-print-only drflow-ehr-print-all-content space-y-3">
            {consultations.map((consultation) => (
              <PatientEhrPrintEvolutionBlock key={consultation.id} consultation={consultation} />
            ))}
          </div>
          <div className="drflow-ehr-print-only drflow-ehr-print-tables-wrap">
            <PatientEhrPrintClinicalTables
              diagnosisRows={diagnosisRows}
              treatmentRows={treatmentRows}
              consultations={consultations}
            />
          </div>
        </div>
      </div>
    </>
  );
}
