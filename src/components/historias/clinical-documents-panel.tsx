"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  CLINICAL_DOCUMENT_CATEGORIES,
  CLINICAL_DOCUMENT_MAX_BYTES,
  clinicalDocumentCategoryLabel,
} from "@/lib/constants/clinical-documents";
import {
  deletePatientClinicalDocument,
  getPatientClinicalDocumentUrl,
  uploadPatientClinicalDocument,
} from "@/lib/actions/patient-attachments";
import { ExternalLink, FileUp, Loader2, Trash2 } from "lucide-react";

export interface ClinicalDocumentItem {
  id: string;
  file_name: string;
  file_size: number | null;
  category: string | null;
  created_at: string;
  profiles?: { full_name: string } | { full_name: string }[] | null;
}

interface Props {
  patientId: string;
  documents: ClinicalDocumentItem[];
  canEdit: boolean;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClinicalDocumentsPanel({ patientId, documents, canEdit }: Props) {
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

  return (
    <Card title="Documentos PDF">
      <p className="mb-4 text-sm text-slate-600">
        Subí historias clínicas previas o estudios en PDF. Quedan asociados al paciente y
        visibles en todas sus consultas.
      </p>

      {canEdit && (
        <div className="mb-4 space-y-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
          <Select
            label="Tipo de documento"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CLINICAL_DOCUMENT_CATEGORIES.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > CLINICAL_DOCUMENT_MAX_BYTES) {
                  setError("El PDF no puede superar 10 MB");
                  e.target.value = "";
                  return;
                }
                void handleUpload(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-4 w-4" />
              Subir PDF
            </Button>
            <span className="text-xs text-slate-500">Máximo 10 MB · solo PDF</span>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">Sin documentos adjuntos.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{doc.file_name}</p>
                <p className="text-sm text-slate-500">
                  {clinicalDocumentCategoryLabel(doc.category)}
                  {" · "}
                  {format(new Date(doc.created_at), "PP", { locale: es })}
                  {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""}
                </p>
                {(() => {
                  const uploader = doc.profiles;
                  const uploaderName = Array.isArray(uploader)
                    ? uploader[0]?.full_name
                    : uploader?.full_name;
                  return uploaderName ? (
                    <p className="text-xs text-slate-400">Subido por {uploaderName}</p>
                  ) : null;
                })()}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={openingId === doc.id || deletingId === doc.id}
                  onClick={() => void handleOpen(doc.id)}
                >
                  {openingId === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  Ver
                </Button>
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    disabled={openingId === doc.id || deletingId === doc.id}
                    onClick={() => void handleDelete(doc.id, doc.file_name)}
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
