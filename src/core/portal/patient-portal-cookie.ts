import { cookies } from "next/headers";

/** HttpOnly patient portal magic-link session cookie (never readable by JS). */
export const PATIENT_PORTAL_COOKIE = "drflow_patient_portal";

const GENERIC_PORTAL_AUTH_ERROR =
  "El enlace de acceso no es válido o venció.";

export function getPortalAuthErrorMessage(): string {
  return GENERIC_PORTAL_AUTH_ERROR;
}

export function getPortalSessionRequiredMessage(): string {
  return "Para ver tus turnos necesitás ingresar desde el enlace seguro enviado por el consultorio.";
}

export function isSecureCookieEnvironment(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  return site.startsWith("https://");
}

export type PortalCookieOptions = {
  expiresAt: Date;
};

export function buildPortalCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isSecureCookieEnvironment(),
    sameSite: "lax" as const,
    path: "/portal",
    expires: expiresAt,
  };
}

/** Read raw portal token from HttpOnly cookie (server-only). */
export async function readPatientPortalToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(PATIENT_PORTAL_COOKIE)?.value?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  return value.toLowerCase();
}

export async function clearPatientPortalCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(PATIENT_PORTAL_COOKIE, "", {
    httpOnly: true,
    secure: isSecureCookieEnvironment(),
    sameSite: "lax",
    path: "/portal",
    expires: new Date(0),
  });
}
