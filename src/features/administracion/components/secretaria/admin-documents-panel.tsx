"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink, FileUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  deletePatientAdminDocument,
  getAdminDocumentUrl,
  uploadPatientAdminDocument,
} from "@/lib/actions/admin-documents";
import {
  ADMIN_DOCUMENT_CATEGORIES,
} from "@/lib/constants/cash-register";

type Doc = {
  id: string;
  title: string;
  file_name: string;
  category: string;
  created_at: string;
  patients?: { first_name: string; last_name: string } | null;
};

export function AdminDocumentsPanel({
  patientId,
  patientLabel,
  documents,
  patients,
  showPatientPicker,
}: {
  patientId?: string;
  patientLabel?: string;
  documents: Doc[];
  patients?: { id: string; label: string }[];
  showPatientPicker?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("general");
  const [title, setTitle] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(patientId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(file: File) {
    const pid = patientId ?? selectedPatient;
    if (!pid) {
      setError("Seleccioná un paciente");
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("patient_id", pid);
    fd.set("category", category);
    fd.set("title", title || file.name);
    fd.set("file", file);
    const res = await uploadPatientAdminDocument(fd);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setTitle("");
      router.refresh();
    }
  }

  return (
    <Card title="Documentación administrativa">
      <p className="mb-3 text-sm text-slate-500">
        Autorizaciones, órdenes y estudios del paciente — separado de la historia clínica.
      </p>
      {showPatientPicker && patients && (
        <Select
          label="Paciente"
          value={selectedPatient}
          onChange={(e) => setSelectedPatient(e.target.value)}
          options={[
            { value: "", label: "— Elegir —" },
            ...patients.map((p) => ({ value: p.id, label: p.label })),
          ]}
        />
      )}
      {patientLabel && <p className="mb-2 text-sm font-medium">{patientLabel}</p>}
      <div className="mb-4 space-y-2 rounded-xl border border-dashed p-4">
        <Select
          label="Categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={ADMIN_DOCUMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
        />
        <input
          type="text"
          placeholder="Título (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="drflow-ui-input w-full rounded-lg border px-3 py-2 text-sm"
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
        />
        <Button type="button" variant="outline" loading={loading} onClick={() => fileRef.current?.click()}>
          <FileUp className="h-4 w-4" />
          Subir documento
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ul className="divide-y divide-slate-600/40">
        {documents.map((d) => {
          const p = d.patients;
          return (
            <li key={d.id} className="flex items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-slate-500">
                  {p ? `${p.last_name}, ${p.first_name} · ` : ""}
                  {format(new Date(d.created_at), "PP", { locale: es })}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const r = await getAdminDocumentUrl(d.id);
                    if (r.url) window.open(r.url, "_blank");
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (confirm("¿Eliminar documento?")) {
                      await deletePatientAdminDocument(d.id);
                      router.refresh();
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
