"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { issuePrescription, savePrescriptionDraft } from "@/features/recetas/actions/prescriptions";
import { appendPrescriptionMedication, emptyPrescriptionMedication } from "@/features/recetas/components/recetas/prescription-form-utils";

import type { PathologySearchResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

type Options = {
  patientId: string;
  clinicalRecordId?: string;
  initialMedications?: PrescriptionMedication[];
  onSuccess?: () => void;
};

export function usePrescriptionForm({
  patientId,
  clinicalRecordId,
  initialMedications,
  onSuccess,
}: Options) {
  const router = useRouter();
  const cie10Ref = useRef<HTMLInputElement>(null);
  const diagnosisTextRef = useRef<HTMLInputElement>(null);
  const [medications, setMedications] = useState<PrescriptionMedication[]>(
    initialMedications && initialMedications.length > 0
      ? initialMedications
      : [emptyPrescriptionMedication()]
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const existingGenericNames = medications
    .map((m) => m.generic_name.trim())
    .filter(Boolean);

  function updateMed(index: number, field: keyof PrescriptionMedication, value: string | number | boolean) {
    setMedications((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  function addMedicationsFromGuide(newMeds: PrescriptionMedication[]) {
    setMedications((prev) => {
      if (newMeds.length === 0) return prev;
      let next = prev;
      for (const med of newMeds) {
        next = appendPrescriptionMedication(next, med);
      }
      return next;
    });
  }

  function handlePathologySelect(pathology: PathologySearchResult) {
    if (cie10Ref.current) cie10Ref.current.value = pathology.cie10_code;
    if (diagnosisTextRef.current) {
      diagnosisTextRef.current.value = pathology.name;
    }
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
    cie10Ref,
    diagnosisTextRef,
    medications,
    setMedications,
    error,
    loading,
    disclaimerAccepted,
    setDisclaimerAccepted,
    existingGenericNames,
    updateMed,
    addMedicationsFromGuide,
    handlePathologySelect,
    handleSubmit,
  };
}
