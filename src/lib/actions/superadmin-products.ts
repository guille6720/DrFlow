"use server";

import { revalidatePath } from "next/cache";

import { requireSuperadminOrDeny } from "@/core/entitlements/superadmin-guard.server";
import { isProductKey, type ProductKey } from "@/core/products/products";
import { setClinicProductAsSuperadmin } from "@/core/products/products.server";

export async function setClinicProductAction(formData: FormData) {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) {
    return {
      ok: false as const,
      error: "Solo el Superadmin puede habilitar o deshabilitar productos.",
    };
  }

  const clinicId = String(formData.get("clinicId") ?? "").trim();
  const productKeyRaw = String(formData.get("productKey") ?? "").trim();
  const enabledRaw = String(formData.get("enabled") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || undefined;

  if (!clinicId) {
    return { ok: false as const, error: "Clínica requerida" };
  }
  if (!isProductKey(productKeyRaw)) {
    return { ok: false as const, error: "Producto inválido" };
  }
  const productKey = productKeyRaw as ProductKey;
  const enabled = enabledRaw === "true" || enabledRaw === "1" || enabledRaw === "on";

  const result = await setClinicProductAsSuperadmin({
    clinicId,
    productKey,
    enabled,
    reason,
  });

  if (result.ok) {
    revalidatePath(`/superadmin/clinics/${clinicId}`);
    revalidatePath("/superadmin/clinics");
  }
  return result;
}
