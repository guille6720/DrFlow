import type { PamiAccess } from "@/lib/integrations/pami/types";

/** Customization keys (USER → CLINIC → GLOBAL DEFAULT, resolved by the feature customizations system). */
export const PAMI_FEATURE_KEYS = {
  integration: "pami_integration",
  prescriptions: "pami_prescriptions",
  medicalOrders: "pami_medical_orders",
} as const;

export type PamiAccessInput = {
  /** RBAC `issuePrescriptions` (with per-user overrides). */
  canIssuePrescriptions: boolean;
  /** RBAC `issueMedicalOrders` (with per-user overrides). */
  canIssueMedicalOrders: boolean;
  /** Plan/product entitlement for clinical documents (`product.clinic`). */
  productEntitled: boolean;
  features: { integration: boolean; prescriptions: boolean; medicalOrders: boolean };
};

/**
 * existing RBAC AND plan/product entitlement AND feature customization.
 * Customizations can only remove access; they never grant a permission the user lacks.
 */
export function resolvePamiAccess(input: PamiAccessInput): PamiAccess {
  const base = input.productEntitled && input.features.integration;
  return {
    prescriptions: base && input.canIssuePrescriptions && input.features.prescriptions,
    medicalOrders: base && input.canIssueMedicalOrders && input.features.medicalOrders,
  };
}

export function hasAnyPamiAccess(access: PamiAccess): boolean {
  return access.prescriptions || access.medicalOrders;
}
