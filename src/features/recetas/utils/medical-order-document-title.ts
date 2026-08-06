export function medicalOrderDocumentTitle(orderType?: string): string {
  if (orderType === "referral") return "Derivación médica";
  if (orderType === "pami_form") return "Planilla PAMI";
  return "Orden de estudios";
}

export function medicalOrderDocumentHeading(orderType?: string): string {
  if (orderType === "referral") return "DERIVACIÓN MÉDICA";
  if (orderType === "pami_form") return "PLANILLA PAMI";
  return "ORDEN MÉDICA";
}
