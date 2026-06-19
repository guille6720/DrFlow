const storageKey = (slug: string) => `drflow-portal-instalado-${slug}`;

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Portal listo: app instalada en pantalla de inicio. */
export function isPatientPortalReady(slug: string): boolean {
  if (typeof window === "undefined") return false;
  if (isStandaloneMode()) return true;
  try {
    return localStorage.getItem(storageKey(slug)) === "1";
  } catch {
    return false;
  }
}

export function markPatientPortalInstalled(slug: string): void {
  try {
    localStorage.setItem(storageKey(slug), "1");
  } catch {
    /* storage no disponible */
  }
}

/** Iconos PWA: tamaños reales 192/512 px con fondo sólido (requerido por Android). */
export const PWA_ICONS = [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" as const },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" as const },
  {
    src: "/icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable" as const,
  },
];

export const PWA_APPLE_ICON = "/icon-192.png";
