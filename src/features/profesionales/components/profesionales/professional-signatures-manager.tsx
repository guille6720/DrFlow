"use client";

import { PenLine, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PlanCapHint } from "@/core/components/entitlements/plan-cap-hint";
import { SignatureImage } from "@/core/components/ui/signature-image";
import { FEATURES } from "@/core/entitlements/features";

import { cn } from "@/shared/utils/cn";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  removeProfessionalSignature,
  updateProfessionalSignatureText,
  uploadProfessionalSignature,
} from "@/lib/actions/professional-signatures";
import { buildProfessionalSignature, getProfessionalDisplayName } from "@/lib/utils/professional";

export type ProfessionalSignatureRow = {
  id: string;
  display_name: string | null;
  license_number: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  signature_text: string | null;
  signature_image_path: string | null;
  signature_image_url: string | null;
  profiles?: { full_name: string } | null;
};

type Props = {
  professionals: ProfessionalSignatureRow[];
  canManageAll: boolean;
};

export function ProfessionalSignaturesManager({ professionals, canManageAll }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(professionals[0]?.id ?? null);
  const [signatureText, setSignatureText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...professionals].sort((a, b) =>
        getProfessionalDisplayName(a).localeCompare(getProfessionalDisplayName(b), "es")
      ),
    [professionals]
  );

  const selected = sorted.find((p) => p.id === selectedId) ?? sorted[0] ?? null;

  const selectedSignatureDefault = selected
    ? selected.signature_text?.trim() || buildProfessionalSignature(selected)
    : "";

  const [prevSelectedId, setPrevSelectedId] = useState(selected?.id ?? null);
  if (selected && selected.id !== prevSelectedId) {
    setPrevSelectedId(selected.id);
    setSignatureText(selectedSignatureDefault);
  }

  function selectProfessional(pro: ProfessionalSignatureRow) {
    setSelectedId(pro.id);
    setMessage(null);
    setError(null);
  }

  async function handleSaveText() {
    if (!selected) return;
    setLoading(true);
    setMessage(null);
    setError(null);

    const formData = new FormData();
    formData.set("professional_id", selected.id);
    formData.set("signature_text", signatureText);

    const result = await updateProfessionalSignatureText(formData);
    setLoading(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    setMessage("Firma de texto guardada.");
    router.refresh();
  }

  async function handleUpload(file: File | null) {
    if (!selected || !file) return;
    setLoading(true);
    setMessage(null);
    setError(null);

    const formData = new FormData();
    formData.set("professional_id", selected.id);
    formData.set("file", file);

    const result = await uploadProfessionalSignature(formData);
    setLoading(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    setMessage("Imagen de firma cargada.");
    router.refresh();
  }

  async function handleRemoveImage() {
    if (!selected) return;
    setLoading(true);
    setMessage(null);
    setError(null);

    const result = await removeProfessionalSignature(selected.id);
    setLoading(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    setMessage("Imagen de firma eliminada.");
    router.refresh();
  }

  if (sorted.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-700">
          No hay profesionales activos. Agregá el equipo en{" "}
          <span className="font-medium">Médicos → Equipo</span>.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="drflow-light-sidebar-panel drflow-card-light h-fit border-slate-200 bg-white">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-800">
          Profesionales
        </p>
        <ul className="space-y-1">
          {sorted.map((pro) => {
            const hasSignature = Boolean(pro.signature_image_path || pro.signature_text?.trim());
            return (
              <li key={pro.id}>
                <button
                  type="button"
                  onClick={() => selectProfessional(pro)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition",
                    selected?.id === pro.id
                      ? "bg-teal-100 font-medium text-teal-950"
                      : "text-slate-800 hover:bg-slate-100"
                  )}
                >
                  <span className="block">{getProfessionalDisplayName(pro)}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs",
                      selected?.id === pro.id ? "text-teal-800" : "text-slate-600"
                    )}
                  >
                    {hasSignature ? "Firma configurada" : "Sin firma"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {selected ? (
        <Card title={`Firma — ${getProfessionalDisplayName(selected)}`}>
          <PlanCapHint feature={FEATURES.STORAGE_MAX_MB} />
          <p className="mb-4 text-sm text-slate-700">
            La firma se aplica automáticamente en evoluciones, recetas, órdenes médicas y documentos
            que requieran firma del profesional.
          </p>

          <div className="drflow-card-light mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-800">
              Vista previa
            </p>
            <div className="min-h-[88px] rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
              {selected.signature_image_url ? (
                <SignatureImage
                  src={selected.signature_image_url}
                  alt={`Firma de ${getProfessionalDisplayName(selected)}`}
                  className="mb-2 max-h-20 max-w-[220px] object-contain"
                />
              ) : null}
              <p className="text-sm font-semibold text-slate-900">
                {signatureText || buildProfessionalSignature(selected)}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Texto de firma"
              value={signatureText}
              onChange={(e) => setSignatureText(e.target.value)}
              placeholder="Dr/a. Nombre Apellido — Mat. XXXXX"
            />

            <div className="flex flex-wrap gap-2">
              <Button type="button" loading={loading} onClick={handleSaveText}>
                Guardar texto
              </Button>
            </div>

            <div className="drflow-card-light rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <PenLine className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-medium text-slate-900">Imagen de firma (opcional)</p>
              </div>
              <p className="mb-3 text-xs text-slate-600">
                PNG, JPEG o WebP con fondo transparente recomendado. Máximo 2 MB.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
                  <Upload className="h-4 w-4" />
                  Subir imagen
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={loading}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      void handleUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {selected.signature_image_path ? (
                  <Button
                    type="button"
                    variant="outline"
                    loading={loading}
                    onClick={() => void handleRemoveImage()}
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar imagen
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {!canManageAll ? (
            <p className="mt-4 text-xs text-slate-600">
              Solo podés editar tu propia firma. Un administrador puede configurar las demás.
            </p>
          ) : null}

          {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
