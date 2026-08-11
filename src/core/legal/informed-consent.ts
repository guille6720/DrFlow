/** Versión del texto de consentimiento informado clínico (incrementar al cambiar el contenido). */
export const INFORMED_CONSENT_DOCUMENT_VERSION = "2026-08-11";

export const INFORMED_CONSENT_DECLARATION_PARAGRAPHS = [
  "Declaro haber sido informado/a de manera comprensible sobre la naturaleza del acto médico o procedimiento propuesto, sus beneficios esperados, riesgos frecuentes y alternativas razonables, conforme la Ley 26.529 de Derechos del Paciente.",
  "Tuve oportunidad de formular preguntas y recibí respuestas satisfactorias. Comprendo que puedo revocar este consentimiento mientras no se haya iniciado el acto, salvo emergencia médica.",
  "Autorizo al profesional y al consultorio a registrar este consentimiento en la historia clínica digital.",
] as const;

export function buildInformedConsentProcedureDefault(chiefComplaint: string | null | undefined): string {
  const trimmed = chiefComplaint?.trim();
  if (trimmed) return `Consulta / acto médico: ${trimmed}`;
  return "Consulta médica y actos derivados de la evaluación clínica";
}

export function informedConsentPatientDisplayName(
  firstName: string,
  lastName: string
): string {
  return `${firstName} ${lastName}`.trim();
}
