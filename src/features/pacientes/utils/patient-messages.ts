/** Mensajes WhatsApp médico ↔ paciente */
export function buildPatientContactMessage(
  patientName: string,
  professionalName?: string
): string {
  const who = professionalName ? `${professionalName} de su consultorio` : "su consultorio";
  return (
    `Hola ${patientName}, le escribe ${who}. ` +
    `¿En qué puedo ayudarlo/a? — DrFlow`
  );
}

export function buildPrescriptionRequestMessage(params: {
  patientName: string;
  documentNumber: string;
  medications: string;
  insuranceNumber?: string;
  /** Si true, etiqueta el n° como PAMI; si no, como afiliado genérico */
  pamiBranding?: boolean;
}): string {
  let coveragePart = "";
  if (params.insuranceNumber) {
    coveragePart = params.pamiBranding
      ? ` | PAMI ${params.insuranceNumber}`
      : ` | Afiliado ${params.insuranceNumber}`;
  }
  return (
    `Hola, soy ${params.patientName}, DNI ${params.documentNumber}${coveragePart}. ` +
    `Solicito renovación / receta de: ${params.medications}. ` +
    `Gracias.`
  );
}

export function buildAppointmentRequestMessage(params: {
  patientName: string;
  documentNumber: string;
  preferredDate?: string;
  reason?: string;
}): string {
  let msg = `Hola, soy ${params.patientName}, DNI ${params.documentNumber}. Quiero solicitar un turno`;
  if (params.preferredDate) msg += ` para ${params.preferredDate}`;
  if (params.reason) msg += `. Motivo: ${params.reason}`;
  return `${msg}. Gracias.`;
}
