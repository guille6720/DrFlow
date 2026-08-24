"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { useClientMounted } from "@/core/hooks/use-client-mounted";

import { cn } from "@/shared/utils/cn";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteMyAccount } from "@/lib/actions/account";
import { DELETE_ACCOUNT_CONFIRM_PHRASE } from "@/lib/constants/account";
import { clearDrFlowClientStorage } from "@/lib/utils/clear-client-storage";

interface DeleteAccountPanelProps {
  userEmail?: string | null;
  isSoleClinicMember?: boolean;
}

export function DeleteAccountPanel({
  userEmail,
  isSoleClinicMember = false,
}: DeleteAccountPanelProps) {
  const mounted = useClientMounted();
  const [open, setOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canConfirm = confirmPhrase.trim() === DELETE_ACCOUNT_CONFIRM_PHRASE;

  function handleOpen() {
    setConfirmPhrase("");
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    setConfirmPhrase("");
    setError(null);
  }

  function handleDelete() {
    setError(null);
    clearDrFlowClientStorage();
    startTransition(async () => {
      const result = await deleteMyAccount(confirmPhrase);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  const modal = open && mounted ? (
    <div className="drflow-modal-root fixed inset-0 z-[9999] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="drflow-modal-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="drflow-modal-panel drflow-card-light relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-red-200 bg-white p-5 text-slate-900 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="delete-account-title" className="text-lg font-semibold text-slate-900">
                Eliminar cuenta
              </h2>
              {userEmail ? (
                <p className="mt-0.5 text-sm text-slate-600">{userEmail}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={pending}
            className="drflow-modal-close rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            Esta acción es <strong>permanente e irreversible</strong>. Perdés el acceso a DrFlow con
            este email y no podés deshacerlo.
          </p>
          {isSoleClinicMember ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-900">
              Sos el único usuario activo del consultorio: se eliminarán también{" "}
              <strong>todos los pacientes, historias clínicas, turnos y configuración</strong> de esa
              clínica.
            </p>
          ) : (
            <p>
              Si pertenecés a un equipo, se te quita del consultorio. Las historias clínicas que
              creaste se conservan y quedan a cargo de otro administrador.
            </p>
          )}
          <p>
            Para confirmar, escribí{" "}
            <strong className="font-mono text-slate-900">{DELETE_ACCOUNT_CONFIRM_PHRASE}</strong>{" "}
            abajo.
          </p>
        </div>

        <div className="mt-4">
          <Input
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={DELETE_ACCOUNT_CONFIRM_PHRASE}
            autoComplete="off"
            disabled={pending}
            className="font-mono text-sm"
            aria-label="Frase de confirmación"
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            disabled={!canConfirm || pending}
            onClick={handleDelete}
          >
            {pending ? "Eliminando…" : "Eliminar mi cuenta"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "drflow-card-light group flex min-h-[10rem] w-full flex-col rounded-2xl border border-red-200/80 bg-white p-5 text-left text-slate-900",
          "shadow-sm transition hover:border-red-300 hover:bg-red-50/40 hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 group-hover:bg-red-200/80">
            <Trash2 className="h-6 w-6" aria-hidden />
          </div>
        </div>
        <p className="mt-4 text-base font-semibold text-red-900">Eliminar cuenta</p>
        <p className="mt-1 text-sm leading-snug text-slate-700">
          Borrá tu usuario de acceso. Si sos el único del consultorio, también se elimina la clínica
          y sus datos.
        </p>
      </button>

      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
