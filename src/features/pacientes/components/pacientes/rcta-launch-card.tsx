"use client";

import { ClipboardList, Copy, ExternalLink, Pill } from "lucide-react";
import { useEffect, useState } from "react";

import { copyTextToClipboard } from "@/core/browser/copy-to-clipboard";
import { toast } from "@/core/notifications/toast";

import { cn } from "@/shared/utils/cn";

import { buttonSurfaceClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRctaLaunchContextAction, type RctaLaunchContextResult } from "@/lib/actions/rcta";
import { RCTA_LINK_REL, RCTA_LINK_TARGET } from "@/lib/integrations/rcta/config";
import { formatRctaPatientClipboard } from "@/lib/integrations/rcta/patient-context";

const muted = "text-[var(--text-muted,var(--muted-foreground))]";
const text = "text-[var(--text-on-card,var(--foreground))]";

async function copyValue(value: string) {
  const result = await copyTextToClipboard(value);
  if (result.ok) toast.copySuccess("Datos copiados");
  else toast.error(result.message);
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => void copyValue(value)}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8",
        muted,
        "hover:bg-[var(--surface-hover,var(--muted))] hover:text-[var(--text-primary,var(--foreground))]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      )}
    >
      <Copy className="h-4 w-4" aria-hidden />
    </button>
  );
}

function Field({
  label,
  value,
  copyLabel,
  copyText,
}: {
  label: string;
  value: string | null;
  copyLabel?: string;
  copyText?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <dt className={cn("text-[11px] uppercase tracking-wide", muted)}>{label}</dt>
        <dd className={cn("break-words text-sm font-medium", text)}>{value}</dd>
      </div>
      {copyLabel ? <CopyButton value={copyText ?? value} label={copyLabel} /> : null}
    </div>
  );
}

type Props = { patientId: string };

/**
 * "Recetas y Órdenes" via RCTA (external link, phase 1). Access is resolved server-side
 * (RBAC + plan + feature customization + clinic scope); the card renders nothing without access.
 */
export function RctaLaunchCard({ patientId }: Props) {
  const [state, setState] = useState<RctaLaunchContextResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getRctaLaunchContextAction(patientId)
      .then((res) => {
        if (!cancelled) setState(res);
      })
      .catch(() => {
        if (!cancelled) setState({ ok: false, reason: "not_allowed" });
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (!state?.ok) return null;
  const { access, patient, launchUrl } = state;

  return (
    <Card
      title="Recetas y Órdenes"
      description="Generá recetas electrónicas y órdenes médicas mediante RCTA."
      className="mb-4"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
            {access.prescriptions ? (
              <a
                href={launchUrl}
                target={RCTA_LINK_TARGET}
                rel={RCTA_LINK_REL}
                aria-label="Generar receta electrónica en RCTA (se abre en una nueva pestaña)"
                className={buttonSurfaceClassName("primary", "md", "w-full sm:w-auto lg:w-full")}
                data-testid="rcta-prescription-link"
              >
                <Pill className="h-4 w-4" aria-hidden />
                Generar receta electrónica
                <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
              </a>
            ) : null}
            {access.medicalOrders ? (
              <a
                href={launchUrl}
                target={RCTA_LINK_TARGET}
                rel={RCTA_LINK_REL}
                aria-label="Generar orden médica en RCTA (se abre en una nueva pestaña)"
                className={buttonSurfaceClassName("outline", "md", "w-full sm:w-auto lg:w-full")}
                data-testid="rcta-medical-order-link"
              >
                <ClipboardList className="h-4 w-4" aria-hidden />
                Generar orden médica
                <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
              </a>
            ) : null}
          </div>
          <p className={cn("text-xs", muted)}>
            RCTA se abrirá en una nueva pestaña. NexClinic permanecerá abierto con la historia clínica del paciente.
          </p>
        </div>

        <section
          aria-label="Datos del paciente para copiar en RCTA"
          className="rounded-xl border border-[var(--border-default,var(--border))] bg-[var(--surface-muted,var(--muted))]/40 p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("text-[11px] uppercase tracking-wide", muted)}>Paciente</p>
              <p className={cn("break-words text-sm font-semibold", text)}>{patient.fullName}</p>
            </div>
            <button
              type="button"
              onClick={() => void copyValue(formatRctaPatientClipboard(patient))}
              className={buttonSurfaceClassName("ghost", "sm", "shrink-0")}
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copiar datos del paciente
            </button>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <Field
              label={patient.documentType && patient.documentType.toUpperCase() !== "DNI" ? patient.documentType : "DNI"}
              value={patient.documentNumberFormatted}
              copyLabel="Copiar DNI"
              copyText={patient.documentNumber}
            />
            <Field label="Nacimiento" value={patient.birthDate} />
            <Field label="Sexo" value={patient.sex} />
            <Field label="Cobertura" value={patient.insuranceProvider} />
            <Field label="Afiliado" value={patient.insuranceNumber} copyLabel="Copiar número de afiliado" />
          </dl>
        </section>
      </div>
    </Card>
  );
}
