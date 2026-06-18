/**
 * Integración futura con REFEPS / RENaPDiS (Ministerio de Salud de la Nación).
 * Hoy las recetas se emiten en modo local con PDF y trazabilidad interna.
 */
export type RefepsSubmitPayload = {
  prescriptionId: string;
  prescriptionNumber: string;
  professionalLicense: string;
  patientDocument: string;
  diagnosisCie10: string;
  medications: unknown[];
};

export async function submitToRefeps(_payload: RefepsSubmitPayload) {
  return {
    ok: false as const,
    error:
      "Integración REFEPS pendiente de homologación. Usá el PDF emitido por DrFlow mientras tanto.",
  };
}
