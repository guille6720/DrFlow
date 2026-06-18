/** Detecta redirect de server actions en Next.js 16+ */
export function isNextRedirect(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = String((error as { digest: unknown }).digest);
  return digest.startsWith("NEXT_REDIRECT");
}
