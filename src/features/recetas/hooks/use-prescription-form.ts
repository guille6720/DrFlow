"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { issuePrescription, savePrescriptionDraft } from "@/features/recetas/actions/prescriptions";
import { emptyPrescriptionMedication } from "@/features/recetas/components/recetas/prescription-form-utils";

import type { PrescriptionMedication } from "@/types/prescription";

type Options = {
  patientId: string;
  clinicalRecordId?: string;
  initialMedications?: PrescriptionMedication[];
  diagnosisDefault?: string;
  cie10Default?: string;
  onSuccess?: () => void;
};

export function usePrescriptionForm({
  patientId,
  clinicalRecordId,
  initialMedications,
  diagnosisDefault = "",
  cie10Default = "",
  onSuccess,
}: Options) {
  const router = useRouter();
  const [diagnosisText, setDiagnosisText] = useState(diagnosisDefault);
  const [cie10, setCie10] = useState(cie10Default);
  const [medications, setMedications] = useState<PrescriptionMedication[]>(
    initialMedications && initialMedications.length > 0
      ? initialMedications
      : [emptyPrescriptionMedication()]
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  function updateMed(index: number, field: keyof PrescriptionMedication, value: string | number | boolean) {
    setMedications((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  async function handleSubmit(issue: boolean) {
    setError(null);
    if (!disclaimerAccepted) {
      setError("Debés aceptar el aviso de receta local / borrador (no homologación REFEPS) para continuar.");
      return;
    }
    setLoading(true);
    const form = document.getElementById("prescription-form") as HTMLFormElement;
    const formData = new FormData(form);
    formData.set("patient_id", patientId);
    if (clinicalRecordId) formData.set("clinical_record_id", clinicalRecordId);
    formData.set("medications_json", JSON.stringify(medications));
    formData.set("disclaimer_accepted", "true");

    const saved = await savePrescriptionDraft(formData);
    if (saved.error) {
      setLoading(false);
      setError(saved.error);
      return;
    }

    if (issue && saved.data) {
      const issued = await issuePrescription(saved.data.id);
      setLoading(false);
      if (issued.error) {
        setError(issued.error);
        return;
      }
    } else {
      setLoading(false);
    }

    onSuccess?.();
    router.refresh();
  }

  return {
    diagnosisText,
    setDiagnosisText,
    cie10,
    setCie10,
    medications,
    setMedications,
    error,
    loading,
    disclaimerAccepted,
    setDisclaimerAccepted,
    updateMed,
    handleSubmit,
  };
}
