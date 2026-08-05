"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink, FileUp, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  CLINICAL_DOCUMENT_CATEGORIES,
  clinicalDocumentCategoryLabel,
} from "@/lib/constants/clinical-documents";
import { useClinicalDocumentsPanel } from "@/lib/hooks/use-clinical-documents-panel";

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
  compact?: boolean;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClinicalDocumentsPanel({ patientId, documents, canEdit, compact }: Props) {
  const {
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
  } = useClinicalDocumentsPanel(patientId);

  return (
    <Card title={compact ? "Documentos" : "Documentos PDF"}>
      {!compact && (
        <p className="mb-4 text-sm">
          Subí historias clínicas previas o estudios en PDF. Quedan asociados al paciente y
          visibles en todas sus consultas.
        </p>
      )}

      {canEdit && (
        <div
          className={
            compact
              ? "mb-3 flex flex-wrap items-end gap-2"
              : "mb-4 space-y-3 rounded-xl border border-dashed drflow-surface-inset p-4"
          }
        >
          <Select
            label={compact ? undefined : "Tipo de documento"}
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
              onChange={handleFileChange}
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
            <span className="text-xs text-slate-500">{compact ? "PDF · 10 MB" : "Máximo 10 MB · solo PDF"}</span>
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
        <ul className={compact ? "grid gap-2 sm:grid-cols-2" : "divide-y divide-slate-600/50"}>
          {documents.map((doc) => (
            <li
              key={doc.id}
              className={
                compact
                  ? "flex items-start justify-between gap-2 rounded-lg border border-slate-600/40 p-2"
                  : "flex items-start justify-between gap-3 py-3"
              }
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{doc.file_name}</p>
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
