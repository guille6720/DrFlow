import type { ReactNode } from "react";

import { FEATURES } from "@/core/entitlements/features";
import { requireAddonFeatureOrRedirect } from "@/core/entitlements/guard.server";

export default async function FacturacionEntitlementLayout({ children }: { children: ReactNode }) {
  await requireAddonFeatureOrRedirect(FEATURES.INSURANCE);
  return children;
}
