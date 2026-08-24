/**
 * Phase 12 — Privacy rights (Ley 25.326 / habeas data) administrative workflow.
 * Distinguishes privacy requests from clinical retention (Ley 26.529).
 * Not legal advice.
 */

import { PRIVACY_VS_RETENTION } from "@/core/compliance/clinical-deletion-protection";

export const PRIVACY_REQUEST_TYPES = [
  "access",
  "correction",
  "export",
  "deletion",
  "blocking",
  "opposition",
] as const;

export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export const PRIVACY_REQUEST_STATUSES = [
  "received",
  "in_review",
  "awaiting_identity",
  "fulfilled",
  "rejected",
  "cancelled",
] as const;

export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];

export const PRIVACY_RETENTION_ACK_ERROR = "PRIVACY_RETENTION_ACK_REQUIRED";

export const PRIVACY_DELETION_RETENTION_WARNING =
  "Un pedido de supresión o bloqueo NO autoriza borrar automáticamente la historia clínica, recetas emitidas ni auditoría. DrFlow solo admite baja lógica del paciente y medidas administrativas; la HC se conserva según la política de retención del consultorio (Ley 26.529).";

export function privacyRequestTypeLabel(type: PrivacyRequestType): string {
  switch (type) {
    case "access":
      return "Acceso";
    case "correction":
      return "Rectificación";
    case "export":
      return "Exportación / portabilidad";
    case "deletion":
      return "Supresión / baja";
    case "blocking":
      return "Bloqueo / oposición al uso";
    case "opposition":
      return "Oposición";
    default:
      return type;
  }
}

export function privacyRequestStatusLabel(status: PrivacyRequestStatus): string {
  switch (status) {
    case "received":
      return "Recibido";
    case "in_review":
      return "En revisión";
    case "awaiting_identity":
      return "Pendiente de identidad";
    case "fulfilled":
      return "Cumplido";
    case "rejected":
      return "Rechazado";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

export function requiresRetentionWarning(type: PrivacyRequestType): boolean {
  return type === "deletion" || type === "blocking";
}

export type PrivacyDeletionEvaluation = {
  allowsAutomatedClinicalHardDelete: false;
  requiresRetentionAcknowledgment: boolean;
  recommendedActions: string[];
  warnings: string[];
  privacyRights: readonly string[];
  retentionObligations: readonly string[];
};

export function evaluatePrivacyDeletionOrBlockingRequest(
  type: PrivacyRequestType
): PrivacyDeletionEvaluation {
  const isSensitive = requiresRetentionWarning(type);
  return {
    allowsAutomatedClinicalHardDelete: false,
    requiresRetentionAcknowledgment: isSensitive,
    recommendedActions: isSensitive
      ? [
          "Exportar paquete Habeas Data / ARCO antes de cualquier baja",
          "Dar de baja lógica al paciente (oculta ficha; no borra HC)",
          "Registrar el pedido con confirmación de retención clínica",
          "Documentar resolución (qué se bloqueó / qué se conserva y por qué)",
        ]
      : [
          "Verificar identidad del solicitante",
          type === "export" || type === "access"
            ? "Usar exportación Habeas Data del paciente"
            : "Actualizar datos demográficos / ficha sin alterar auditoría clínica",
          "Cerrar el pedido con notas de resolución",
        ],
    warnings: isSensitive
      ? [PRIVACY_DELETION_RETENTION_WARNING, PRIVACY_VS_RETENTION.productRule]
      : [],
    privacyRights: PRIVACY_VS_RETENTION.privacyRights,
    retentionObligations: PRIVACY_VS_RETENTION.retentionObligations,
  };
}

export function canFulfillPrivacyRequest(params: {
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  retentionWarningAcknowledged: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (params.status !== "fulfilled") return { ok: true };
  if (requiresRetentionWarning(params.type) && !params.retentionWarningAcknowledged) {
    return {
      ok: false,
      error:
        "Para marcar como cumplido un pedido de supresión/bloqueo debés confirmar que la HC no se destruirá automáticamente (retención clínica).",
    };
  }
  return { ok: true };
}

export type PrivacyRightsPosture = {
  workflowEnabled: true;
  automatedClinicalHardDelete: false;
  requestTypes: typeof PRIVACY_REQUEST_TYPES;
  notes: string[];
};

export function evaluatePrivacyRightsPosture(): PrivacyRightsPosture {
  return {
    workflowEnabled: true,
    automatedClinicalHardDelete: false,
    requestTypes: PRIVACY_REQUEST_TYPES,
    notes: [
      "Cola administrativa privacy_rights_requests (migración 135).",
      "Exportación ARCO existente: exportPatientArcoBundle / habeas-data-export.",
      "Baja de paciente = lógica; no hard-delete de HC (Fases 7–8).",
      "Cumplir deletion/blocking exige retention_warning_acknowledged.",
    ],
  };
}
