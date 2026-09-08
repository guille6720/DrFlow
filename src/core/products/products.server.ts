import "server-only";

import { cache } from "react";

import { hasProduct } from "@/core/products/product-access";
import {
  type ClinicProductsSnapshot,
  emptyClinicProducts,
  type ProductKey,
} from "@/core/products/products";
import { asStagingSchemaClient } from "@/core/products/staging-schema-client";
import { createClient } from "@/core/supabase/server";

export class ProductRequiredError extends Error {
  readonly productKey: ProductKey;
  constructor(productKey: ProductKey) {
    super(`PRODUCT_REQUIRED:${productKey}`);
    this.name = "ProductRequiredError";
    this.productKey = productKey;
  }
}

type ProductsRpcRow = {
  clinic_id?: string;
  "product.clinic"?: boolean;
  "product.geriatrics"?: boolean;
};

function parseProductsPayload(
  clinicId: string,
  data: unknown
): ClinicProductsSnapshot {
  const row = (Array.isArray(data) ? data[0] : data) as ProductsRpcRow | null;
  if (!row || typeof row !== "object") {
    return emptyClinicProducts(clinicId);
  }
  return {
    clinicId,
    clinic: Boolean(row["product.clinic"]),
    geriatrics: Boolean(row["product.geriatrics"]),
    catalogAvailable: true,
  };
}

export const loadClinicProducts = cache(async (clinicId: string): Promise<ClinicProductsSnapshot> => {
  if (!clinicId) return emptyClinicProducts(null);
  try {
    const supabase = asStagingSchemaClient(await createClient());
    const { data, error } = await supabase.rpc("get_clinic_products", {
      p_clinic_id: clinicId,
    });
    if (error) {
      // Fail-open for clinic (legacy), fail-closed for geriatrics via empty snapshot.
      return emptyClinicProducts(clinicId);
    }
    return parseProductsPayload(clinicId, data);
  } catch {
    return emptyClinicProducts(clinicId);
  }
});

export async function requireProduct(
  clinicId: string,
  productKey: ProductKey
): Promise<ClinicProductsSnapshot> {
  const snapshot = await loadClinicProducts(clinicId);
  if (!hasProduct(snapshot, productKey)) {
    throw new ProductRequiredError(productKey);
  }
  return snapshot;
}

export async function setClinicProductAsSuperadmin(input: {
  clinicId: string;
  productKey: ProductKey;
  enabled: boolean;
  reason?: string;
}): Promise<{ ok: true; previousEnabled: boolean; enabled: boolean } | { ok: false; error: string }> {
  const supabase = asStagingSchemaClient(await createClient());
  const { data, error } = await supabase.rpc("set_clinic_product", {
    p_clinic_id: input.clinicId,
    p_product_key: input.productKey,
    p_enabled: input.enabled,
    p_reason: input.reason ?? null,
  });
  if (error) {
    const msg = error.message ?? "FORBIDDEN";
    if (msg.includes("FORBIDDEN") || msg.includes("NOT_AUTHENTICATED")) {
      return { ok: false, error: "Solo el Superadmin puede modificar productos." };
    }
    return { ok: false, error: msg };
  }
  const row = data as {
    ok?: boolean;
    enabled?: boolean;
    previous_enabled?: boolean;
  } | null;
  return {
    ok: true,
    enabled: Boolean(row?.enabled),
    previousEnabled: Boolean(row?.previous_enabled),
  };
}
