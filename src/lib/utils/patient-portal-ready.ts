const storageKey = (slug: string) => `drflow-portal-listo-${slug}`;

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isPatientPortalReady(slug: string): boolean {
  if (typeof window === "undefined") return false;
  if (isStandaloneMode()) return true;
  try {
    return localStorage.getItem(storageKey(slug)) === "1";
  } catch {
    return false;
  }
}

export function markPatientPortalReady(slug: string): void {
  try {
    localStorage.setItem(storageKey(slug), "1");
  } catch {
    /* storage no disponible */
  }
}
