import { sanitizeDisplayText } from "@/core/security/xss";

/** Texto clínico listo para mostrar al usuario (sin marcas de import ni branding ajeno). */
export function sanitizeClinicalDisplayText(text: string | null | undefined): string {
  if (!text) return "";
  const stripped = sanitizeDisplayText(text, 50_000);
  return stripped
    .replace(/^\[(?:DRAPP|IMPORT|HCE|PDF|Import):[^\]]+\]\s*/gim, "")
    .replace(/https?:\/\/[^\s\n]*drapp[^\s\n]*/gi, "")
    .replace(/\bdr\.?\s*app\b/gi, "")
    .replace(/\bdrapp\b/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
