"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  resetClinicCoverageRule,
  saveClinicCoverageRule,
} from "@/features/recetas/actions/coverage-rules";
import { DEFAULT_COVERAGE_RULES } from "@/features/recetas/engine/default-coverage-rules";
import type { CoverageKind } from "@/features/recetas/engine/types";
import type { CoverageRuleRow } from "@/features/recetas/repositories/coverage-rules.repository";
import {
  COVERAGE_REQUIRED_FIELD_OPTIONS,
  defaultRuleSummary,
  formatInfoMessagesText,
  getEffectiveCoverageRule,
} from "@/features/recetas/utils/coverage-rules-admin";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  coverageKind?: CoverageKind;
  savedRule: CoverageRuleRow | null;
};

export function PrescriptionCoverageRulesPanel({
  coverageKind = "PAMI",
  savedRule,
}: Props) {
  const router = useRouter();
  const defaults = DEFAULT_COVERAGE_RULES[coverageKind];
  const effective = useMemo(
    () => getEffectiveCoverageRule(coverageKind, savedRule?.rules),
    [coverageKind, savedRule]
  );

  const [requiredFields, setRequiredFields] = useState<string[]>(
    effective.requiredFields ?? defaults.requiredFields
  );
  const [maxValidityDays, setMaxValidityDays] = useState(
    String(effective.maxValidityDays ?? defaults.maxValidityDays ?? 30)
  );
  const [medicationSearch, setMedicationSearch] = useState(
    effective.medicationSearch ?? defaults.medicationSearch
  );
  const [documentQr, setDocumentQr] = useState(
    effective.documentQr ?? defaults.documentQr ?? false
  );
  const [infoMessagesText, setInfoMessagesText] = useState(
    formatInfoMessagesText(effective.infoMessages ?? defaults.infoMessages)
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleRequiredField(field: string) {
    setRequiredFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const formData = new FormData();
    formData.set("coverage_kind", coverageKind);
    formData.set("max_validity_days", maxValidityDays);
    formData.set("medication_search", medicationSearch);
    if (documentQr) formData.set("document_qr", "true");
    formData.set("info_messages_text", infoMessagesText);
    for (const field of requiredFields) {
      formData.append("required_fields", field);
    }

    const result = await saveClinicCoverageRule(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage("Reglas guardadas. Aplican al emitir recetas nuevas.");
    router.refresh();
  }

  async function handleReset() {
    if (!window.confirm("¿Restaurar los defaults de la app para PAMI?")) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    const result = await resetClinicCoverageRule(coverageKind);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage("Defaults restaurados.");
    router.refresh();
  }

  return (
    <Card title="Motor de recetas — reglas PAMI">
      <p className="mb-3 text-sm text-slate-600">
        Configurá validaciones al emitir recetas para pacientes PAMI. Los cambios aplican en el
        servidor al guardar o emitir; no inventan normativa REFEPS/PMO.
      </p>

      <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <span className="font-semibold">Defaults de la app:</span> {defaultRuleSummary(coverageKind)}
      </p>

      {savedRule ? (
        <p className="mb-4 text-xs font-medium text-teal-800">
          Esta clínica tiene reglas personalizadas activas.
        </p>
      ) : (
        <p className="mb-4 text-xs text-slate-500">Usando defaults de la app (sin override en DB).</p>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-900">Campos obligatorios al emitir</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {COVERAGE_REQUIRED_FIELD_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={requiredFields.includes(option.value)}
                  onChange={() => toggleRequiredField(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Vigencia máxima (días)"
            type="number"
            min={1}
            max={365}
            value={maxValidityDays}
            onChange={(e) => setMaxValidityDays(e.target.value)}
          />
          <Select
            label="Búsqueda de medicamentos"
            value={medicationSearch}
            onChange={(e) => setMedicationSearch(e.target.value as typeof medicationSearch)}
            options={[
              { value: "pami_vademecum", label: "Vademécum PAMI" },
              { value: "pharmacology", label: "Farmacología general" },
              { value: "manual", label: "Solo manual" },
            ]}
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={documentQr}
            onChange={(e) => setDocumentQr(e.target.checked)}
          />
          Mostrar bloque QR de verificación local en PDF / vista previa
        </label>

        <Textarea
          label="Mensajes informativos (uno por línea, advertencias no bloqueantes)"
          rows={4}
          value={infoMessagesText}
          onChange={(e) => setInfoMessagesText(e.target.value)}
          placeholder="Paciente PAMI: verificá beneficio antes de emitir."
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-teal-700">{message}</p> : null}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button type="submit" loading={loading}>
            Guardar reglas PAMI
          </Button>
          <Button type="button" variant="outline" loading={loading} onClick={() => void handleReset()}>
            <RotateCcw className="h-4 w-4" />
            Restaurar defaults
          </Button>
        </div>
      </form>

      <p className="mt-4 text-xs text-slate-500">
        Ver gaps normativos en{" "}
        <code className="rounded bg-slate-100 px-1">docs/prescription-pami-config.md</code>. Planillas
        PAMI siguen en{" "}
        <Link href="/pami/planillas" className="text-teal-700 underline">
          Planillas
        </Link>
        .
      </p>
    </Card>
  );
}
