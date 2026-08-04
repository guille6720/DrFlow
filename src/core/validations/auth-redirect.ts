import { z } from "zod";

/** Relative in-app redirect path — blocks open redirects (`//evil.com`). */
export const safeRedirectPathSchema = z
  .string()
  .max(500)
  .refine((p) => p.startsWith("/"), "Ruta inválida")
  .refine((p) => !p.startsWith("//"), "Ruta inválida")
  .refine((p) => !p.includes("\\"), "Ruta inválida");

export const otpTypeSchema = z.enum([
  "signup",
  "recovery",
  "invite",
  "email",
  "email_change",
  "magiclink",
]);

export const boundedErrorDescriptionSchema = z.string().max(500);

export function parseSafeRedirectPath(
  value: string | null | undefined,
  fallback: string
): string {
  const parsed = safeRedirectPathSchema.safeParse(value ?? fallback);
  return parsed.success ? parsed.data : fallback;
}
