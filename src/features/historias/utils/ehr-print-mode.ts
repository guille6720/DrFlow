export type EhrPrintScope = "all" | "day";

const DATA_ATTR = "data-ehr-print";

export function activateEhrPrintMode(scope: EhrPrintScope): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(DATA_ATTR, scope);
}

export function deactivateEhrPrintMode(): void {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute(DATA_ATTR);
}

export function readEhrPrintMode(): EhrPrintScope | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.getAttribute(DATA_ATTR);
  return value === "all" || value === "day" ? value : null;
}

export function isEhrPrintSurfacePresent(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(".drflow-ehr-print-surface") !== null;
}
