export const CLINICAL_OPS_SECTION_IDS = [
  "ops-schedule",
  "ops-waiting",
  "ops-urgent",
  "ops-alerts",
  "ops-tasks",
  "ops-notifications",
] as const;

export type ClinicalOpsSectionId = (typeof CLINICAL_OPS_SECTION_IDS)[number];

export function isClinicalOpsSectionId(value: string): value is ClinicalOpsSectionId {
  return (CLINICAL_OPS_SECTION_IDS as readonly string[]).includes(value);
}

export function scrollToClinicalOpsSection(sectionId: string): boolean {
  if (typeof document === "undefined") return false;

  const el = document.getElementById(sectionId);
  if (!el) return false;

  el.scrollIntoView({ behavior: "smooth", block: "start" });

  if (typeof window !== "undefined") {
    const nextUrl = `${window.location.pathname}${window.location.search}#${sectionId}`;
    window.history.replaceState(null, "", nextUrl);
  }

  return true;
}
