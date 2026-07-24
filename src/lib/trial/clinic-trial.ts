import type { Clinic } from "@/types/database";

export const TRIAL_REGISTRATION_COOKIE = "drflow_trial_days";
export const TRIAL_PROMO_DAYS = 30;

/** Rutas permitidas cuando el trial expiró (sin acceso clínico). */
export const TRIAL_EXPIRED_WHITELIST = [
  "/trial-expirado",
  "/configuracion",
  "/ayuda",
] as const;

export function isTrialWhitelistedPath(path: string): boolean {
  return TRIAL_EXPIRED_WHITELIST.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function isClinicTrialExpired(clinic: Pick<Clinic, "trial_ends_at"> | null): boolean {
  if (!clinic?.trial_ends_at) return false;
  return new Date(clinic.trial_ends_at).getTime() < Date.now();
}

export function trialDaysRemaining(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function parseTrialDays(value: unknown): number | null {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 365) return null;
  return n;
}
