"use client";

import { useFeature } from "@/core/components/customizations/feature-customizations-provider";
import { useHasClinicProduct } from "@/core/components/products/products-provider";

import { RCTA_FEATURE_KEYS } from "@/lib/integrations/rcta/access";
import { RCTA_EXTERNAL_URL, RCTA_LINK_REL, RCTA_LINK_TARGET } from "@/lib/integrations/rcta/config";

export type RctaPrescriptionsLink = {
  /** True when new prescriptions should be written in RCTA instead of the internal editor. */
  enabled: boolean;
  href: string;
  target: typeof RCTA_LINK_TARGET;
  rel: typeof RCTA_LINK_REL;
};

/**
 * UX routing only: callers keep their own RBAC gate (issuePrescriptions). No patient data is added
 * to the RCTA URL. Falls back to the internal editor when the clinic/user disabled RCTA.
 */
export function useRctaPrescriptions(): RctaPrescriptionsLink {
  const integration = useFeature(RCTA_FEATURE_KEYS.integration).enabled;
  const prescriptions = useFeature(RCTA_FEATURE_KEYS.prescriptions).enabled;
  const clinicProduct = useHasClinicProduct();
  return {
    enabled: integration && prescriptions && clinicProduct,
    href: RCTA_EXTERNAL_URL,
    target: RCTA_LINK_TARGET,
    rel: RCTA_LINK_REL,
  };
}

export function openRctaPrescriptions(link: Pick<RctaPrescriptionsLink, "href">): void {
  window.open(link.href, RCTA_LINK_TARGET, "noopener,noreferrer");
}
