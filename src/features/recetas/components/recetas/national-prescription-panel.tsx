"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Landmark, RefreshCw, Send, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { useFeature } from "@/core/components/customizations/feature-customizations-provider";
import { NATIONAL_RX_STATE_LABELS, type NationalRxState } from "@/core/renapdis/national-state-machine";

import { Button } from "@/components/ui/button";
import {
  cancelNationalPrescriptionAction,
  getNationalPrescriptionStatusAction,
  refreshNationalPrescriptionAction,
  submitNationalPrescriptionAction,
} from "@/lib/actions/national-prescription";

type StatusView = Awaited<ReturnType<typeof getNationalPrescriptionStatusAction>>;

const SANDBOX_LABEL = "SANDBOX / TEST — NOT VALID FOR DISPENSING";

const SUBMITTABLE: ReadonlySet<string> = new Set([
  "issued_local",
  "professional_validation_failed",
  "repository_submission_failed",
  "repository_unavailable",
]);
const CANCELLABLE: ReadonlySet<string> = new Set([
  "repository_submitted",
  "cuir_assigned",
  "cuir_verification_failed",
  "professional_validation_failed",
  "repository_submission_failed",
  "repository_unavailable",
]);

function Row({ label, ok, value }: { label: string; ok: boolean | null; value: string }) {
  const Icon = ok === null ? CircleDashed : ok ? CheckCircle2 : XCircle;
  const tone = ok === null ? "text-[var(--muted-foreground)]" : ok ? "text-emerald-600" : "text-red-600";
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="inline-flex items-center gap-1 font-medium text-[var(--foreground)]">
        <Icon className={`h-3.5 w-3.5 ${tone}`} aria-hidden />
        {value}
      </span>
    </div>
  );
}

function refepsRow(status: StatusView): { ok: boolean | null; value: string } {
  if (!status?.refepsProfessionalStatus) return { ok: null, value: "Sin validar" };
  if (status.refepsProfessionalStatus === "validated") {
    return status.refepsValidationMode === "sandbox"
      ? { ok: true, value: "Validado (sandbox)" }
      : { ok: true, value: "Validado REFEPS" };
  }
  if (status.refepsProfessionalStatus === "unavailable") return { ok: false, value: "REFEPS no disponible" };
  if (status.refepsProfessionalStatus === "inactive") return { ok: false, value: "Profesional inactivo" };
  return { ok: false, value: "No encontrado en REFEPS" };
}

function repositoryRow(status: StatusView): { ok: boolean | null; value: string } {
  if (!status?.repositoryMode) return { ok: null, value: "Sin enviar" };
  if (status.repositoryMode === "sandbox") return { ok: true, value: "Sandbox (prueba)" };
  return { ok: true, value: "Conectado" };
}

/**
 * Distinguishes LOCAL vs NATIONAL prescription. Renders nothing unless the clinic has the
 * `national_electronic_prescription` feature (UX only — the server re-checks every gate).
 */
export function NationalPrescriptionPanel({ prescriptionId }: { prescriptionId: string }) {
  const { enabled } = useFeature("national_electronic_prescription");
  const router = useRouter();
  const [status, setStatus] = useState<StatusView>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const next = await getNationalPrescriptionStatusAction(prescriptionId);
    setStatus(next);
    setLoaded(true);
  }, [prescriptionId]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void getNationalPrescriptionStatusAction(prescriptionId).then((next) => {
      if (cancelled) return;
      setStatus(next);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, prescriptionId]);

  if (!enabled || !loaded || !status) return null;

  const state = (status.state ?? "issued_local") as NationalRxState;
  const isSandbox = status.repositoryMode === "sandbox";
  const refeps = refepsRow(status);
  const repo = repositoryRow(status);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok && "message" in result && result.message) setMessage(result.message);
      await load();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated,var(--card))] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
          <Landmark className="h-3.5 w-3.5" aria-hidden />
          {state === "issued_local" ? "Receta local" : "Receta electrónica nacional"}
        </p>
        <span className="text-[11px] text-[var(--muted-foreground)]">{NATIONAL_RX_STATE_LABELS[state]}</span>
      </div>

      {isSandbox ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold tracking-wide text-amber-900">
          {SANDBOX_LABEL}
        </p>
      ) : null}

      {state !== "issued_local" ? (
        <div className="space-y-1">
          <Row label="Profesional" ok={refeps.ok} value={refeps.value} />
          <Row label="Repositorio" ok={repo.ok} value={repo.value} />
          {isSandbox ? (
            <Row label="Referencia de prueba" ok={null} value={status.sandboxReference ?? "—"} />
          ) : (
            <Row label="CUIR" ok={status.cuir ? true : null} value={status.cuir ?? "Pendiente"} />
          )}
        </div>
      ) : null}

      {message ? (
        <p className="flex items-start gap-1 text-[11px] text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {SUBMITTABLE.has(state) ? (
          <Button
            size="sm"
            variant="outline"
            loading={pending}
            pendingLabel="Enviando…"
            onClick={() => run(() => submitNationalPrescriptionAction(prescriptionId))}
          >
            <Send className="h-3.5 w-3.5" /> Enviar como receta nacional
          </Button>
        ) : null}
        {!isSandbox && (state === "repository_submitted" || state === "cuir_assigned") ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => refreshNationalPrescriptionAction(prescriptionId))}>
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar estado
          </Button>
        ) : null}
        {CANCELLABLE.has(state) ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("¿Anular la receta electrónica nacional? La receta local no se modifica.")) return;
              run(() => cancelNationalPrescriptionAction(prescriptionId, "otro"));
            }}
          >
            Anular nacional
          </Button>
        ) : null}
      </div>
    </div>
  );
}
