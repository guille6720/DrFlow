"use client";

import { useState } from "react";

import { toast } from "@/core/notifications/toast";

import { updateClinicalRecordConsultationAt } from "@/features/historias/actions/update-consultation-at";
import { usePatientEhrStateContext } from "@/features/historias/components/historias/patient-ehr-state-context";
import { toPatientEhrDatetimeLocalValue } from "@/features/historias/components/historias/patient-ehr-utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  recordId: string;
  createdAt: string;
  dateLabel: string;
};

export function PatientEhrTableDateCell({ recordId, createdAt, dateLabel }: Props) {
  const { patchConsultationDate } = usePatientEhrStateContext();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => toPatientEhrDatetimeLocalValue(createdAt));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (recordId.startsWith("hce-")) {
    return <span>{dateLabel}</span>;
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const iso = new Date(value).toISOString();
      const result = await updateClinicalRecordConsultationAt(recordId, iso);
      if (result.error) {
        setError(result.error);
        return;
      }
      patchConsultationDate(recordId, iso);
      toast.success("Fecha guardada");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la fecha.");
    } finally {
      setLoading(false);
    }
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
        className="text-left hover:underline"
        title="Editar fecha"
      >
        {dateLabel}
      </button>
    );
  }

  return (
    <div className="min-w-[160px] space-y-1">
      <Input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 text-xs"
      />
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" className="h-7 px-2 text-xs" loading={loading} onClick={() => void handleSave()}>
          Guardar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={loading}
          onClick={() => {
            setValue(toPatientEhrDatetimeLocalValue(createdAt));
            setEditing(false);
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
