"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PrescriberMfaStatus } from "@/core/auth/prescriber-mfa.types";
import type { RefepsValidationStatus } from "@/core/renapdis/types";

import type { ProfessionalIntakeDetail } from "@/features/profesionales/components/profesionales/professional-intake-types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  confirmPrescriberMfaEnrollment,
  elevatePrescriberMfaSession,
  enrollPrescriberMfa,
  runProfessionalRefepsValidation,
  updateProfessionalRenapdisIdentity,
} from "@/lib/actions/professional-verification";

const STATUS_LABEL: Record<RefepsValidationStatus, string> = {
  sandbox: "sandbox",
  validated: "validated",
  pending: "pending",
  failed: "failed",
  not_configured: "not_configured",
};

const STATUS_CLASS: Record<RefepsValidationStatus, string> = {
  sandbox: "border-amber-300 bg-amber-50 text-amber-950",
  validated: "border-emerald-300 bg-emerald-50 text-emerald-950",
  pending: "border-sky-300 bg-sky-50 text-sky-950",
  failed: "border-red-300 bg-red-50 text-red-950",
  not_configured: "border-slate-300 bg-slate-50 text-slate-800",
};

type Props = {
  selected: ProfessionalIntakeDetail;
  mfa: PrescriberMfaStatus;
  canManage: boolean;
  canPrescribe: boolean;
};

export function ProfessionalRenapdisSection({ selected, mfa, canManage, canPrescribe }: Props) {
  const router = useRouter();
  const status = selected.refeps_validation_status ?? "not_configured";
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [elevateFactorId, setElevateFactorId] = useState(mfa.factors[0]?.id ?? "");

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    fd.set("professional_id", selected.id);
    const result = await updateProfessionalRenapdisIdentity(fd);
    setBusy(false);
    if ("error" in result) setErr(result.error);
    else {
      setMsg(result.message);
      router.refresh();
    }
  }

  async function onValidate() {
    if (!canManage) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    const result = await runProfessionalRefepsValidation(selected.id);
    setBusy(false);
    if ("error" in result) setErr(result.error);
    else {
      setMsg(result.message);
      router.refresh();
    }
  }

  async function onStartMfa() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const result = await enrollPrescriberMfa();
    setBusy(false);
    if ("error" in result) setErr(result.error);
    else setEnroll(result.data);
  }

  async function onConfirmMfa() {
    if (!enroll) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    const result = await confirmPrescriberMfaEnrollment({
      factorId: enroll.factorId,
      code: totpCode,
    });
    setBusy(false);
    if ("error" in result) setErr(result.error);
    else {
      setMsg("MFA enrolado. Sesión elevada (AAL2).");
      setEnroll(null);
      setTotpCode("");
      router.refresh();
    }
  }

  async function onElevate() {
    const factorId = elevateFactorId || mfa.factors[0]?.id || "";
    if (!factorId) {
      setErr("No hay factor MFA disponible.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setErr(null);
    const result = await elevatePrescriberMfaSession({ factorId, code: totpCode });
    setBusy(false);
    if ("error" in result) setErr(result.error);
    else {
      setMsg("Sesión elevada (AAL2).");
      setTotpCode("");
      router.refresh();
    }
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
      aria-labelledby="renapdis-validation-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="renapdis-validation-heading" className="text-sm font-semibold text-slate-900">
            Validación profesional — ReNaPDiS
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Identidad, matrícula y estado REFEPS. La validación corre solo en el servidor.
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
        <strong>Aviso:</strong> el estado <code>sandbox</code> no tiene validez legal para receta
        electrónica nacional. No constituye homologación ReNaPDiS / MSN.
      </div>

      {msg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {err}
        </p>
      ) : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Última validación</dt>
          <dd>
            {selected.refeps_validated_at
              ? new Date(selected.refeps_validated_at).toLocaleString("es-AR")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Identificador REFEPS</dt>
          <dd className="break-all">{selected.refeps_identifier?.trim() || "—"}</dd>
        </div>
        {selected.refeps_validation_error ? (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Error / detalle</dt>
            <dd className="text-red-700">{selected.refeps_validation_error}</dd>
          </div>
        ) : null}
      </dl>

      <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
        <Input
          name="cuil"
          label="CUIL"
          defaultValue={selected.cuil ?? selected.tax_id ?? ""}
          disabled={!canManage || busy}
        />
        <Input
          name="license_number"
          label="Matrícula / licencia"
          defaultValue={
            selected.license_number ??
            selected.license_national ??
            selected.license_provincial ??
            ""
          }
          disabled={!canManage || busy}
        />
        <Input
          name="licensing_jurisdiction"
          label="Jurisdicción"
          defaultValue={selected.licensing_jurisdiction ?? ""}
          disabled={!canManage || busy}
        />
        <Input
          name="issuing_authority"
          label="Autoridad emisora"
          defaultValue={selected.issuing_authority ?? ""}
          disabled={!canManage || busy}
        />
        <Input
          name="refeps_specialty"
          label="Especialidad (REFEPS)"
          defaultValue={selected.refeps_specialty ?? selected.specialties?.name ?? ""}
          disabled={!canManage || busy}
        />
        <Input
          name="refeps_identifier"
          label="Identificador REFEPS"
          defaultValue={selected.refeps_identifier ?? ""}
          disabled={!canManage || busy}
        />

        {canManage ? (
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              Guardar identidad ReNaPDiS
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void onValidate()}>
              Validar REFEPS
            </Button>
          </div>
        ) : null}
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          {mfa.elevated ? (
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
          )}
          MFA del prescritor (sesión actual)
        </h4>
        {!canPrescribe ? (
          <p className="text-sm text-slate-600">
            Tu rol no emite recetas: MFA de prescritor no es obligatorio para este usuario.
          </p>
        ) : (
          <>
            <dl className="grid gap-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">MFA configurado</dt>
                <dd>{mfa.enrolled ? "Sí" : "No"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Nivel de sesión (AAL)</dt>
                <dd>{mfa.currentLevel}</dd>
              </div>
            </dl>

            {!mfa.enrolled && !enroll ? (
              <Button type="button" className="mt-3" disabled={busy} onClick={() => void onStartMfa()}>
                Configurar MFA TOTP
              </Button>
            ) : null}

            {enroll ? (
              <div className="mt-3 space-y-2">
                <Image
                  src={enroll.qrCode}
                  alt="QR MFA TOTP"
                  width={144}
                  height={144}
                  unoptimized
                  className="rounded border border-slate-200 bg-white p-2"
                />
                <p className="break-all text-xs text-slate-500">Secreto: {enroll.secret}</p>
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="Código de 6 dígitos"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <Button
                  type="button"
                  disabled={busy || totpCode.length < 6}
                  onClick={() => void onConfirmMfa()}
                >
                  Confirmar enrolamiento
                </Button>
              </div>
            ) : null}

            {mfa.enrolled && !mfa.elevated ? (
              <div className="mt-3 space-y-2">
                {mfa.factors.length > 0 ? (
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Factor TOTP</span>
                    <select
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      value={elevateFactorId || mfa.factors[0]?.id || ""}
                      onChange={(e) => setElevateFactorId(e.target.value)}
                    >
                      {mfa.factors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.friendlyName ?? f.id}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="Código TOTP"
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  disabled={busy || totpCode.length < 6}
                  onClick={() => void onElevate()}
                >
                  Elevar sesión (AAL2)
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
