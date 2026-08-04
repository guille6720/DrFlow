"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CLINICAL_DOCUMENT_MAX_BYTES } from "@/lib/constants/clinical-documents";
import {
  deletePatientClinicalDocument,
  getPatientClinicalDocumentUrl,
  uploadPatientClinicalDocument,
} from "@/features/pacientes/actions/patient-attachments";

export function useClinicalDocumentsPanel(patientId: string) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("historia_clinica");
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("patient_id", patientId);
    formData.set("category", category);
    formData.set("file", file);
    const result = await uploadPatientClinicalDocument(formData);
    setUploading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  async function handleOpen(id: string) {
    setOpeningId(id);
    setError(null);
    const result = await getPatientClinicalDocumentUrl(id);
    setOpeningId(null);
    if (result.error || !result.url) {
      setError(result.error ?? "No se pudo abrir el documento");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(id: string, fileName: string) {
    if (!confirm(`¿Eliminar "${fileName}"?`)) return;
    setDeletingId(id);
    setError(null);
    const result = await deletePatientClinicalDocument(id);
    setDeletingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > CLINICAL_DOCUMENT_MAX_BYTES) {
      setError("El PDF no puede superar 10 MB");
      e.target.value = "";
      return;
    }
    void handleUpload(file);
  }

  return {
    fileInputRef,
    category,
    setCategory,
    uploading,
    openingId,
    deletingId,
    error,
    handleOpen,
    handleDelete,
    handleFileChange,
  };
}
