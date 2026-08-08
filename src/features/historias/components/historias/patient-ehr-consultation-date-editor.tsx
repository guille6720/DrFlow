"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateClinicalRecordConsultationAt } from "@/features/historias/actions/clinical-records";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  recordId: string;
  createdAt: string;
};

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function PatientEhrConsultationDateEditor({ recordId, createdAt }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => toDatetimeLocalValue(createdAt));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    const result = await updateClinicalRecordConsultationAt(recordId, new Date(value).toISOString());
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
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
          setValue(toDatetimeLocalValue(createdAt));
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
