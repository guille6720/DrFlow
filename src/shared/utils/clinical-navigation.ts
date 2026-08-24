/** Query param: el usuario llegó desde /historias/paciente/[id] */
export const FROM_CLINICAL_HISTORY = "historia";

/** Query param: el usuario llegó desde Médicos → Consultas (sesión en curso). */
export const FROM_CONSULTA = "consulta";

/** Ruta canónica de HC del paciente (historial clínico ordenado, sin consulta en curso). */
export function patientClinicalHistoryPath(patientId: string): string {
  return `/pacientes/${patientId}?tab=soap`;
}

/** Datos del paciente: alta/edición de ficha administrativa y perfil clínico. */
export function patientFichaPath(patientId: string): string {
  return `/pacientes/${patientId}/editar`;
}

/** Agrega ?from=historia para que «Volver» regrese a la HC del paciente. */
export function withClinicalHistoryReturn(path: string, patientId: string): string {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("from", FROM_CLINICAL_HISTORY);
  params.set("patient", patientId);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * HC general del paciente con retorno a la sesión de Consultas.
 * «Volver» en la ficha vuelve a /consultas?appointment=…&action=nueva
 */
export function patientClinicalHistoryFromConsultaPath(opts: {
  patientId: string;
  appointmentId?: string | null;
  professionalId?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("tab", "soap");
  params.set("from", FROM_CONSULTA);
  if (opts.appointmentId) params.set("appointment", opts.appointmentId);
  if (opts.professionalId) params.set("professional", opts.professionalId);
  return `/pacientes/${opts.patientId}?${params.toString()}`;
}

/** Destino de «Volver» cuando from=consulta. */
export function consultaSessionReturnPath(opts: {
  appointmentId?: string | null;
  patientId?: string | null;
  professionalId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.appointmentId) {
    params.set("appointment", opts.appointmentId);
    params.set("action", "nueva");
  } else if (opts.patientId) {
    params.set("patient", opts.patientId);
    params.set("action", "nueva");
  } else {
    return "/consultas";
  }
  if (opts.professionalId) params.set("professional", opts.professionalId);
  return `/consultas?${params.toString()}`;
}

export function isFromClinicalHistory(from: string | null | undefined): boolean {
  return from === FROM_CLINICAL_HISTORY;
}

export function isFromConsulta(from: string | null | undefined): boolean {
  return from === FROM_CONSULTA;
}

export function backHrefFromClinicalSubpage(
  from: string | null | undefined,
  patientId: string,
  defaultHref: string
): string {
  return isFromClinicalHistory(from) ? patientClinicalHistoryPath(patientId) : defaultHref;
}
