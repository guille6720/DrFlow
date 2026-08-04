/** Normaliza teléfono AR y arma link wa.me (recordatorio sin API). */
export function normalizeArgentinaPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;

  if (digits.startsWith("549") && digits.length >= 12) return digits;
  if (digits.startsWith("54") && digits.length >= 11) return digits;
  if (digits.startsWith("0")) return `54${digits.slice(1)}`;
  if (digits.length === 10) return `549${digits}`;
  if (digits.length === 11 && digits.startsWith("9")) return `54${digits}`;

  return `54${digits}`;
}

export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const normalized = normalizeArgentinaPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/** Compartir mensaje sin número: el usuario elige el contacto en WhatsApp. */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
