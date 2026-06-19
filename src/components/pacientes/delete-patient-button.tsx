"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deactivatePatient } from "@/lib/actions/settings";
import { Trash2, X } from "lucide-react";

interface DeletePatientButtonProps {
  patientId: string;
  patientName: string;
}

export function DeletePatientButton({ patientId, patientName }: DeletePatientButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const result = await deactivatePatient(patientId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.push("/pacientes");
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-red-200 text-red-700 hover:bg-red-50"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Eliminar paciente
      </Button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Cerrar"
            onClick={() => !loading && setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Eliminar paciente</h2>
                <p className="mt-1 text-sm text-slate-600">{patientName}</p>
              </div>
              <button
                type="button"
                onClick={() => !loading && setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm leading-relaxed text-slate-600">
              El paciente dejará de aparecer en el listado. Las consultas y turnos ya registrados
              se conservan en el historial del consultorio.
            </p>

            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="danger" loading={loading} onClick={handleDelete}>
                Sí, eliminar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
