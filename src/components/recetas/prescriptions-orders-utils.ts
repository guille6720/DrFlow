export function orderTypeLabel(type?: string): string {
  if (type === "referral") return "Derivación";
  if (type === "pami_form") return "Planilla PAMI";
  return "Estudios";
}

export function buildOrderWhatsAppUrl(phone: string | null | undefined, text: string): string {
  const digits = phone?.replace(/\D/g, "") ?? "";
  const url = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${url}?text=${encodeURIComponent(text)}`;
}
