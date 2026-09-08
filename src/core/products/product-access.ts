import type { ClinicProductsSnapshot, ProductKey } from "@/core/products/products";
import { PRODUCTS } from "@/core/products/products";

/** Pure helpers safe for client + server. */
export function hasProduct(
  snapshot: ClinicProductsSnapshot,
  productKey: ProductKey
): boolean {
  if (productKey === PRODUCTS.CLINIC) {
    if (!snapshot.catalogAvailable) return true;
    return snapshot.clinic;
  }
  if (!snapshot.catalogAvailable) return false;
  return snapshot.geriatrics;
}

export function hasAnyProduct(snapshot: ClinicProductsSnapshot): boolean {
  return hasProduct(snapshot, PRODUCTS.CLINIC) || hasProduct(snapshot, PRODUCTS.GERIATRICS);
}

export function toClientProductsSnapshot(
  snapshot: ClinicProductsSnapshot
): ClinicProductsSnapshot {
  return {
    clinicId: snapshot.clinicId,
    clinic: snapshot.clinic,
    geriatrics: snapshot.geriatrics,
    catalogAvailable: snapshot.catalogAvailable,
  };
}
