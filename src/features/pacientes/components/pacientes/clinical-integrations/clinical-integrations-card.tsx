"use client";

import { ClipboardList, Landmark, Pill, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { ExternalClinicalIntegrationButton } from "@/features/pacientes/components/pacientes/clinical-integrations/external-clinical-integration-button";
import {
  fetchPamiLaunchContext,
  fetchRctaLaunchContext,
} from "@/features/pacientes/components/pacientes/clinical-integrations/integration-context-fetch";
import {
  integrationMutedText,
  PatientIntegrationContext,
} from "@/features/pacientes/components/pacientes/clinical-integrations/patient-integration-context";

import { Card } from "@/components/ui/card";
import { PAMI_LINK_REL, PAMI_LINK_TARGET } from "@/lib/integrations/pami/config";
import { isCanonicalPamiCoverage } from "@/lib/integrations/pami/coverage";
import type { PamiLaunchContextResult, PamiPatientContext } from "@/lib/integrations/pami/types";
import { RCTA_LINK_REL, RCTA_LINK_TARGET } from "@/lib/integrations/rcta/config";
import type { RctaLaunchContextResult } from "@/lib/integrations/rcta/types";

export type ClinicalIntegrationSection = "prescriptions" | "medicalOrders";

type Contexts = { rcta: RctaLaunchContextResult; pami: PamiLaunchContextResult };

async function fetchContexts(patientId: string): Promise<Contexts> {
  const [rcta, pami] = await Promise.all([fetchRctaLaunchContext(patientId), fetchPamiLaunchContext(patientId)]);
  return { rcta, pami };
}

const COPY = {
  prescriptions: {
    title: "Receta electrónica",
    description: "Elegí el sistema en el que vas a emitir la receta.",
    rcta: {
      label: "Nueva receta electrónica RCTA",
      aria: "Nueva receta electrónica en RCTA (se abre en una nueva pestaña)",
      icon: Pill,
      testId: "rcta-prescription-link",
    },
    pami: {
      label: "Receta PAMI",
      aria: "Receta PAMI: abrir el sistema oficial de PAMI (se abre en una nueva pestaña)",
      testId: "pami-prescription-link",
    },
  },
  medicalOrders: {
    title: "Orden médica electrónica",
    description: "Elegí el sistema en el que vas a emitir la orden médica.",
    rcta: {
      label: "Nueva orden médica RCTA",
      aria: "Nueva orden médica en RCTA (se abre en una nueva pestaña)",
      icon: ClipboardList,
      testId: "rcta-medical-order-link",
    },
    pami: {
      label: "Orden PAMI / OME",
      aria: "Orden médica electrónica PAMI (OME): abrir el sistema oficial de PAMI (se abre en una nueva pestaña)",
      testId: "pami-medical-order-link",
    },
  },
} as const;

function patientFrom(ctx: Contexts): PamiPatientContext | null {
  if (ctx.pami.ok) return ctx.pami.patient;
  if (!ctx.rcta.ok) return null;
  return {
    ...ctx.rcta.patient,
    cuil: null,
    cuilFormatted: null,
    pamiCoverage: isCanonicalPamiCoverage(ctx.rcta.patient.insuranceProvider),
  };
}

type Props = { patientId: string; section: ClinicalIntegrationSection };

/**
 * External prescribing systems for one clinical section (RCTA and official PAMI pages, both link-only).
 * Access is resolved server-side (RBAC + plan + feature customization + clinic scope); the card renders
 * nothing when the user has no action in this section. PAMI coverage only changes emphasis, never access.
 */
export function ClinicalIntegrationsCard({ patientId, section }: Props) {
  const [contexts, setContexts] = useState<Contexts | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchContexts(patientId).then((res) => {
      if (!cancelled) setContexts(res);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (!contexts) return null;
  const { rcta, pami } = contexts;
  const rctaUrl = rcta.ok && rcta.access[section] ? rcta.launchUrl : null;
  const pamiUrl =
    pami.ok && pami.access[section]
      ? section === "prescriptions"
        ? pami.prescriptionUrl
        : pami.medicalOrderUrl
      : null;
  const patient = patientFrom(contexts);
  if ((!rctaUrl && !pamiUrl) || !patient) return null;

  const copy = COPY[section];
  const pamiFirst = Boolean(pamiUrl) && patient.pamiCoverage;

  const rctaButton = rctaUrl ? (
    <ExternalClinicalIntegrationButton
      key="rcta"
      href={rctaUrl}
      target={RCTA_LINK_TARGET}
      rel={RCTA_LINK_REL}
      label={copy.rcta.label}
      ariaLabel={copy.rcta.aria}
      icon={copy.rcta.icon}
      prioritized={!pamiFirst}
      testId={copy.rcta.testId}
    />
  ) : null;
  const pamiButton = pamiUrl ? (
    <ExternalClinicalIntegrationButton
      key="pami"
      href={pamiUrl}
      target={PAMI_LINK_TARGET}
      rel={PAMI_LINK_REL}
      label={copy.pami.label}
      ariaLabel={copy.pami.aria}
      icon={Landmark}
      prioritized={pamiFirst || !rctaUrl}
      testId={copy.pami.testId}
    />
  ) : null;

  return (
    <Card
      title={copy.title}
      description={copy.description}
      className="mb-4"
      action={
        patient.pamiCoverage ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default,var(--border))] px-2.5 py-1 text-xs font-semibold text-[var(--text-on-card,var(--foreground))]"
            data-testid="pami-coverage-indicator"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Cobertura PAMI
          </span>
        ) : null
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
            {pamiFirst ? [pamiButton, rctaButton] : [rctaButton, pamiButton]}
          </div>
          <div className={cn("space-y-1 text-xs", integrationMutedText)}>
            {rctaUrl ? <p>RCTA se abrirá en una nueva pestaña.</p> : null}
            {pamiUrl ? (
              <>
                <p>Se abrirá el sistema oficial de PAMI en una nueva pestaña.</p>
                <p>
                  Si ya tenés una sesión activa en CUP/PAMI, PAMI podrá reutilizarla. Si la sesión venció, deberás
                  identificarte nuevamente.
                </p>
              </>
            ) : null}
            <p>NexClinic permanecerá abierto con la historia clínica del paciente.</p>
          </div>
        </div>

        <PatientIntegrationContext patient={patient} label="Datos del paciente para copiar manualmente" />
      </div>
    </Card>
  );
}
