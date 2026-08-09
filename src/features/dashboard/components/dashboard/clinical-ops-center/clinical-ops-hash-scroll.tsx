"use client";

import { useEffect } from "react";

import { isClinicalOpsSectionId, scrollToClinicalOpsSection } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-scroll";

/** Scrolls to `#ops-*` on first paint when the dashboard opens with a hash. */
export function ClinicalOpsHashScroll() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!isClinicalOpsSectionId(hash)) return;

    const timer = window.setTimeout(() => {
      scrollToClinicalOpsSection(hash);
    }, 100);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
