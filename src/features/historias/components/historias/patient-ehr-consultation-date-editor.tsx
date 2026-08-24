"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

import { toast } from "@/core/notifications/toast";

import { updateClinicalRecordConsultationAt } from "@/features/historias/actions/clinical-records";
import { usePatientEhrStateContext } from "@/features/historias/components/historias/patient-ehr-state-context";
import { toPatientEhrDatetimeLocalValue } from "@/features/historias/components/historias/patient-ehr-utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  recordId: string;
  createdAt: string;
};

export function PatientEhrConsultationDateEditor({ recordId, createdAt }: Props) {
  const { patchConsultationDate } = usePatientEhrStateContext();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => toPatientEhrDatetimeLocalValue(createdAt));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    const iso = new Date(value).toISOString();
    const result = await updateClinicalRecordConsultationAt(recordId, iso);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    patchConsultationDate(recordId, iso);
    toast.success("Fecha guardada");
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(toPatientEhrDatetimeLocalValue(createdAt));
          setError(null);
          setEditing(true);
        }}
        className="text-left text-xs drflow-ehr-muted hover:underline"
        title="Editar fecha de la consulta"
      >
        {format(new Date(createdAt), "EEEE d MMMM yyyy · HH:mm", { locale: es })}
      </button>
    );
  }

  return (
    <div className="mb-2 flex flex-wrap items-end gap-2">
      <div className="min-w-[220px] flex-1">
        <Input
          type="datetime-local"
          label="Fecha de la consulta"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="button" size="sm" loading={loading} onClick={() => void handleSave()}>
        Guardar fecha
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => {
          setValue(toPatientEhrDatetimeLocalValue(createdAt));
          setEditing(false);
          setError(null);
        }}
      >
        Cancelar
      </Button>
      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
