export function orderTypeLabel(type?: string): string {
  if (type === "referral") return "Derivación";
  if (type === "pami_form") return "Planilla PAMI";
  return "Estudios";
}
