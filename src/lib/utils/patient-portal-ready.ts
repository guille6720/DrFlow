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
export function getPwaIcons(origin: string) {
  const base = origin.replace(/\/$/, "");
  return [
    { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" as const },
    { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" as const },
    {
      src: `${base}/icon-maskable-512.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable" as const,
    },
  ];
}

/** Rutas relativas para metadata HTML. */
export const PWA_ICONS = getPwaIcons("");

export const PWA_APPLE_ICON = "/icon-192.png";

export function buildPatientAppInstallUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, "")}/portal/${slug}/instalar`;
}

export function buildPatientAppShareMessage(
  clinicName: string,
  installUrl: string,
  patientName?: string
): string {
  const greeting = patientName ? `Hola ${patientName}!` : "Hola!";
  return [
    `${greeting} Soy del consultorio ${clinicName}.`,
    "",
    "Instalá la app en tu celular para pedir turnos y recetas PAMI:",
    installUrl,
    "",
    "Pasos:",
    "1. Tocá el link de arriba",
    '2. Apretá "Agregar a pantalla de inicio"',
    "3. Listo — queda el icono azul en tu celular",
  ].join("\n");
}
