import { NextResponse } from "next/server";

import { getActiveClinicId } from "@/core/auth/session.server";
import { hasProduct } from "@/core/products/product-access";
import { PRODUCTS } from "@/core/products/products";
import { loadClinicProducts } from "@/core/products/products.server";

/** Server-side product gate for geriatrics API surface. */
export async function GET() {
  const clinicId = await getActiveClinicId();
  if (!clinicId) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  const products = await loadClinicProducts(clinicId);
  if (!hasProduct(products, PRODUCTS.GERIATRICS)) {
    return NextResponse.json(
      { ok: false, error: "PRODUCT_REQUIRED:geriatrics" },
      { status: 403 }
    );
  }
  return NextResponse.json({ ok: true, product: "geriatrics" });
}
