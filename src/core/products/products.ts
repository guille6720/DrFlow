/** Platform product keys — independent of commercial plan features. */
export const PRODUCTS = {
  CLINIC: "clinic",
  GERIATRICS: "geriatrics",
} as const;

export type ProductKey = (typeof PRODUCTS)[keyof typeof PRODUCTS];

export const PRODUCT_FEATURE_KEYS = {
  CLINIC: "product.clinic",
  GERIATRICS: "product.geriatrics",
} as const;

export type ProductFeatureKey =
  (typeof PRODUCT_FEATURE_KEYS)[keyof typeof PRODUCT_FEATURE_KEYS];

export type ClinicProductsSnapshot = {
  clinicId: string | null;
  /** product.clinic */
  clinic: boolean;
  /** product.geriatrics */
  geriatrics: boolean;
  /** False when RPC/table unavailable — fail CLOSED for geriatrics, OPEN for clinic (legacy). */
  catalogAvailable: boolean;
};

export function emptyClinicProducts(clinicId: string | null = null): ClinicProductsSnapshot {
  return {
    clinicId,
    clinic: true,
    geriatrics: false,
    catalogAvailable: false,
  };
}

export function isProductKey(value: string): value is ProductKey {
  return value === PRODUCTS.CLINIC || value === PRODUCTS.GERIATRICS;
}

export function productLabel(key: ProductKey): string {
  return key === PRODUCTS.CLINIC ? "Clínica" : "Geriatría";
}
