"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PrescriptionPharmacologyPicker } from "@/components/recetas/prescription-pharmacology-picker";
import { savePrescriptionDraft, issuePrescription } from "@/lib/actions/prescriptions";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { PrescriptionMedication } from "@/types/prescription";
import { ARGENTINA_PRESCRIPTION_DISCLAIMER } from "@/types/prescription";
import type { PathologySearchResult } from "@/types/pharmacology";
import { Plus, Trash2 } from "lucide-react";

interface Professional {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
}

interface Props {
  patientId: string;
  patientInsurance?: string | null;
  clinicalRecordId?: string;
  diagnosisDefault?: string;
  cie10Default?: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  onSuccess?: () => void;
}

const emptyMed = (): PrescriptionMedication => ({
  generic_name: "",
  brand_name: "",
  presentation: "",
  concentration: "",
  quantity: 1,
  posology: "",
  route: "oral",
});

export function PrescriptionForm({
  patientId,
  patientInsurance,
  clinicalRecordId,
  diagnosisDefault = "",
  cie10Default = "",
  professionals,
  defaultProfessionalId,
  onSuccess,
}: Props) {
  const router = useRouter();
  const cie10Ref = useRef<HTMLInputElement>(null);
  const diagnosisTextRef = useRef<HTMLInputElement>(null);
  const [medications, setMedications] = useState<PrescriptionMedication[]>([emptyMed()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const hasOnlyEmpty =
        prev.length === 1 && !prev[0].generic_name.trim() && !prev[0].posology.trim();
      if (hasOnlyEmpty) return newMeds;
      return [...prev, ...newMeds];
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

  return (
    <form id="prescription-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        {ARGENTINA_PRESCRIPTION_DISCLAIMER}
      </div>

      <PrescriptionPharmacologyPicker
        onPathologySelect={handlePathologySelect}
        onAddMedications={addMedicationsFromGuide}
        existingGenericNames={existingGenericNames}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          name="professional_id"
          label="Profesional prescriptor"
          required
          defaultValue={defaultProfessionalId}
          options={professionals.map((p) => ({
            value: p.id,
            label: `${getProfessionalDisplayName(p)}${p.license_number ? ` — Mat. ${p.license_number}` : ""}`,
          }))}
          placeholder="Seleccionar"
        />
        <Select
          name="prescription_type"
          label="Tipo de receta"
          required
          defaultValue="ambulatoria"
          options={[
            { value: "ambulatoria", label: "Ambulatoria" },
            { value: "cronica", label: "Crónica / prolongada" },
            { value: "duplicado", label: "Duplicado (psicotrópicos)" },
          ]}
        />
        <Input
          ref={cie10Ref}
          name="diagnosis_cie10"
          label="Diagnóstico CIE-10"
          required
          defaultValue={cie10Default}
          placeholder="Ej: I10, J06.9"
        />
        <Input
          name="patient_insurance"
          label="Obra social / prepaga"
          defaultValue={patientInsurance ?? ""}
          placeholder="Opcional"
        />
        <div className="sm:col-span-2">
          <Input
            ref={diagnosisTextRef}
            name="diagnosis_text"
            label="Diagnóstico (texto)"
            required
            defaultValue={diagnosisDefault}
            placeholder="Ej: Hipertensión arterial esencial"
          />
        </div>
        <Input name="validity_days" label="Vigencia (días)" type="number" defaultValue={30} min={1} max={365} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">Medicamentos (nombre genérico — Ley 25.649)</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMedications((m) => [...m, emptyMed()])}
          >
            <Plus className="h-4 w-4" />
            Agregar manual
          </Button>
        </div>

        {medications.map((med, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Medicamento {index + 1}</span>
              {medications.length > 1 && (
                <button
                  type="button"
                  onClick={() => setMedications((m) => m.filter((_, i) => i !== index))}
                  className="text-red-600 hover:text-red-800"
                  aria-label="Quitar medicamento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Nombre genérico *"
                required
                value={med.generic_name}
                onChange={(e) => updateMed(index, "generic_name", e.target.value)}
                placeholder="Ej: Enalapril"
              />
              <Input
                label="Marca (opcional)"
                value={med.brand_name ?? ""}
                onChange={(e) => updateMed(index, "brand_name", e.target.value)}
              />
              <Input
                label="Presentación"
                value={med.presentation ?? ""}
                onChange={(e) => updateMed(index, "presentation", e.target.value)}
                placeholder="Ej: comp x 30"
              />
              <Input
                label="Concentración"
                value={med.concentration ?? ""}
                onChange={(e) => updateMed(index, "concentration", e.target.value)}
                placeholder="Ej: 10 mg"
              />
              <Input
                label="Cantidad"
                type="number"
                min={1}
                value={med.quantity}
                onChange={(e) => updateMed(index, "quantity", Number(e.target.value))}
              />
              <Input
                label="Vía"
                value={med.route ?? ""}
                onChange={(e) => updateMed(index, "route", e.target.value)}
                placeholder="oral, tópica..."
              />
              <div className="sm:col-span-2">
                <Input
                  label="Posología *"
                  required
                  value={med.posology}
                  onChange={(e) => updateMed(index, "posology", e.target.value)}
                  placeholder="Ej: 1 comp cada 12 hs por 7 días"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Textarea name="notes" label="Observaciones" rows={2} placeholder="Indicaciones adicionales para farmacia" />

      <input type="hidden" name="disclaimer_accepted" value="on" />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" loading={loading} onClick={() => handleSubmit(false)}>
          Guardar borrador
        </Button>
        <Button type="button" loading={loading} onClick={() => handleSubmit(true)}>
          Emitir receta
        </Button>
      </div>
    </form>
  );
}
