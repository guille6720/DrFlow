/**
 * Phase 21 — Subscription cancellation & consumer-rights posture.
 * Technical UI/support only — legal applicability of withdrawal rights
 * REQUIERE REVISIÓN LEGAL SEGÚN TIPO DE CLIENTE B2B/B2C.
 * Not legal advice.
 */

export const CONSUMER_RIGHTS_LEGAL_REVIEW =
  "REQUIERE REVISIÓN LEGAL SEGÚN TIPO DE CLIENTE B2B/B2C" as const;

export type CancellationCapability = {
  id: string;
  label: string;
  technicalStatus: "implemented" | "partial" | "not_applicable_yet" | "external";
  notes: string;
};

export const CANCELLATION_CAPABILITIES: CancellationCapability[] = [
  {
    id: "self_serve_cancel_ui",
    label: "Cancelación self-serve en Configuración → Plan",
    technicalStatus: "implemented",
    notes: "Un clic + confirmación única; sin encuesta ni retención forzada.",
  },
  {
    id: "access_until_period_end",
    label: "Acceso hasta fin del período ya pagado",
    technicalStatus: "implemented",
    notes: "status=canceled con current_period_end futuro sigue otorgando acceso.",
  },
  {
    id: "no_dark_patterns",
    label: "Sin obstáculos innecesarios",
    technicalStatus: "implemented",
    notes: "No exige teléfono, chat ni pasos múltiples de retención.",
  },
  {
    id: "mp_preapproval_cancel",
    label: "Cancelación de Preapproval recurrente en Mercado Pago",
    technicalStatus: "partial",
    notes:
      "Checkout Pro actual es preferencia por cobro; si hay preapproval_id futuro, cancelar en MP es pendiente.",
  },
  {
    id: "service_cancellation_ui",
    label: "UI de baja del servicio (suscripción SaaS)",
    technicalStatus: "implemented",
    notes: "Evaluación técnica: sí hace falta UI — implementada para clinic_admin/settings.",
  },
  {
    id: "withdrawal_right_ui",
    label: "UI específica de derecho de arrepentimiento / retiro",
    technicalStatus: "partial",
    notes:
      "Se informa que puede aplicar según tipo de cliente; no se afirma aplicabilidad legal desde el código.",
  },
  {
    id: "b2b_b2c_legal",
    label: "Aplicabilidad B2B vs B2C / consumo",
    technicalStatus: "external",
    notes: CONSUMER_RIGHTS_LEGAL_REVIEW,
  },
];

export type CancellationEligibility =
  | { ok: true; mode: "end_of_period" }
  | { ok: false; error: string };

export function evaluateCancellationEligibility(input: {
  status: string | null | undefined;
  canceledAt?: string | null;
}): CancellationEligibility {
  const status = input.status?.trim() || null;
  if (!status) {
    return { ok: false, error: "No hay suscripción para cancelar." };
  }
  if (status === "canceled") {
    return { ok: false, error: "La suscripción ya está cancelada." };
  }
  if (status === "manual") {
    return {
      ok: false,
      error: "Este acceso fue activado manualmente. Contactá a ventas para darlo de baja.",
    };
  }
  if (status === "active" || status === "past_due" || status === "trialing") {
    return { ok: true, mode: "end_of_period" };
  }
  return { ok: false, error: "Estado de suscripción no cancelable desde la app." };
}

/** Shared helper: canceled still counts as paid-through access until period end. */
export function subscriptionGrantsAccess(input: {
  status: string | null | undefined;
  currentPeriodEnd: string | null | undefined;
  nowMs?: number;
}): boolean {
  const status = input.status?.trim() || null;
  if (!status) return false;
  const now = input.nowMs ?? Date.now();
  const periodEnd = input.currentPeriodEnd ? new Date(input.currentPeriodEnd).getTime() : null;
  const periodOk = periodEnd == null || periodEnd > now;

  if (status === "manual") {
    return periodOk;
  }
  if (status === "active") {
    return periodOk;
  }
  if (status === "canceled") {
    // Paid-through only: require an explicit future period end.
    return periodEnd != null && periodEnd > now;
  }
  return false;
}

export type CancellationConsumerRightsPosture = {
  selfServeCancelRequired: true;
  unnecessaryObstaclesForbidden: true;
  legalApplicabilityFromCodeAlone: false;
  legalReviewMarker: typeof CONSUMER_RIGHTS_LEGAL_REVIEW;
  capabilityCount: number;
  notes: string[];
};

export function evaluateCancellationConsumerRightsPosture(): CancellationConsumerRightsPosture {
  return {
    selfServeCancelRequired: true,
    unnecessaryObstaclesForbidden: true,
    legalApplicabilityFromCodeAlone: false,
    legalReviewMarker: CONSUMER_RIGHTS_LEGAL_REVIEW,
    capabilityCount: CANCELLATION_CAPABILITIES.length,
    notes: [
      "UI de baja de suscripción implementada (settings).",
      "Derecho de arrepentimiento / consumo: " + CONSUMER_RIGHTS_LEGAL_REVIEW,
      "No decidir aplicabilidad legal solo desde el código.",
    ],
  };
}
