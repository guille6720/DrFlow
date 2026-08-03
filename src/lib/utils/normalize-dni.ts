/** Normaliza DNI argentino: solo dígitos, 7–8 caracteres. */
export function normalizeDni(
  raw: string | undefined | null,
  options?: { trimNineDigit?: boolean }
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 8) return digits;
  if (options?.trimNineDigit && digits.length === 9) return digits.slice(-8);
  return null;
}
