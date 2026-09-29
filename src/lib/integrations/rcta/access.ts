import type { RctaAccess } from "@/lib/integrations/rcta/types";

/** Customization keys (USER → CLINIC → GLOBAL DEFAULT, resolved by the feature customizations system). */
export const RCTA_FEATURE_KEYS = {
  integration: "rcta_integration",
  prescriptions: "rcta_prescriptions",
  medicalOrders: "rcta_medical_orders",
} as const;

export type RctaAccessInput = {
  /** RBAC `issuePrescriptions` (with per-user overrides). */
  canIssuePrescriptions: boolean;
  /** RBAC `issueMedicalOrders` (with per-user overrides). */
  canIssueMedicalOrders: boolean;
  /** Plan/product entitlement for clinical documents (`product.clinic`). */
  productEntitled: boolean;
  features: { integration: boolean; prescriptions: boolean; medicalOrders: boolean };
};

/**
 * existing_permissions AND plan/product entitlement AND feature customization.
 * Customizations can only remove access; they never grant a permission the user lacks.
 */
export function resolveRctaAccess(input: RctaAccessInput): RctaAccess {
  const base = input.productEntitled && input.features.integration;
  return {
    prescriptions: base && input.canIssuePrescriptions && input.features.prescriptions,
    medicalOrders: base && input.canIssueMedicalOrders && input.features.medicalOrders,
  };
}

export function hasAnyRctaAccess(access: RctaAccess): boolean {
  return access.prescriptions || access.medicalOrders;
}
