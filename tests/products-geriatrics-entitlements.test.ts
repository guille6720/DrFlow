import { describe, expect, it } from "vitest";

import { PLATFORM_PRODUCT_PRICING } from "@/core/billing/product-pricing";
import {
  emptyClinicProducts,
  hasAnyProduct,
  hasProduct,
  PRODUCTS,
} from "@/core/products";
import {
  canAccessPathWithProducts,
  isHrefAllowedByProducts,
  routeRequiresProduct,
} from "@/core/products/route-products";

describe("clinic products entitlements", () => {
  it("TEST 1 shape: clinic ON geriatrics OFF keeps clinic routes", () => {
    const snap = {
      clinicId: "a",
      clinic: true,
      geriatrics: false,
      catalogAvailable: true,
    };
    expect(hasProduct(snap, PRODUCTS.CLINIC)).toBe(true);
    expect(hasProduct(snap, PRODUCTS.GERIATRICS)).toBe(false);
    expect(canAccessPathWithProducts("/consultas", snap)).toBe(true);
    expect(canAccessPathWithProducts("/geriatria", snap)).toBe(false);
    expect(isHrefAllowedByProducts("/geriatria/residentes", snap)).toBe(false);
  });

  it("TEST 2 shape: clinic OFF geriatrics ON allows only geriatrics product routes", () => {
    const snap = {
      clinicId: "a",
      clinic: false,
      geriatrics: true,
      catalogAvailable: true,
    };
    expect(canAccessPathWithProducts("/geriatria", snap)).toBe(true);
    expect(canAccessPathWithProducts("/consultas", snap)).toBe(false);
    expect(canAccessPathWithProducts("/turnos/agenda", snap)).toBe(false);
    expect(canAccessPathWithProducts("/dashboard", snap)).toBe(true);
    expect(canAccessPathWithProducts("/configuracion", snap)).toBe(true);
  });

  it("TEST 3 shape: both ON", () => {
    const snap = {
      clinicId: "a",
      clinic: true,
      geriatrics: true,
      catalogAvailable: true,
    };
    expect(hasAnyProduct(snap)).toBe(true);
    expect(canAccessPathWithProducts("/consultas", snap)).toBe(true);
    expect(canAccessPathWithProducts("/geriatria/medicacion", snap)).toBe(true);
  });

  it("TEST 4 shape: both OFF → no product routes; shared paths ok", () => {
    const snap = {
      clinicId: "a",
      clinic: false,
      geriatrics: false,
      catalogAvailable: true,
    };
    expect(hasAnyProduct(snap)).toBe(false);
    expect(canAccessPathWithProducts("/sin-productos", snap)).toBe(true);
    expect(canAccessPathWithProducts("/geriatria", snap)).toBe(false);
    expect(canAccessPathWithProducts("/caja", snap)).toBe(false);
  });

  it("TEST 5/8: direct URL /geriatria denied when OFF", () => {
    const snap = {
      clinicId: "a",
      clinic: true,
      geriatrics: false,
      catalogAvailable: true,
    };
    expect(routeRequiresProduct("/geriatria/foo")).toBe(PRODUCTS.GERIATRICS);
    expect(canAccessPathWithProducts("/geriatria", snap)).toBe(false);
  });

  it("legacy fail-open for clinic when catalog missing; geriatrics fail-closed", () => {
    const snap = emptyClinicProducts("x");
    expect(snap.catalogAvailable).toBe(false);
    expect(hasProduct(snap, PRODUCTS.CLINIC)).toBe(true);
    expect(hasProduct(snap, PRODUCTS.GERIATRICS)).toBe(false);
  });

  it("pricing centralized (no clinical hardcode)", () => {
    expect(PLATFORM_PRODUCT_PRICING.geriatrics.promoPriceArs).toBe(59_000);
    expect(PLATFORM_PRODUCT_PRICING.geriatrics.regularPriceArs).toBe(79_000);
    expect(PLATFORM_PRODUCT_PRICING.geriatrics.autoCheckout).toBe(false);
    expect(PLATFORM_PRODUCT_PRICING.clinic_geriatrics_bundle.regularPriceArs).toBe(99_000);
  });
});
