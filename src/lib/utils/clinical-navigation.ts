/** Query param: el usuario llegó desde /historias/paciente/[id] */
export const FROM_CLINICAL_HISTORY = "historia";

export function patientClinicalHistoryPath(patientId: string): string {
  return `/historias/paciente/${patientId}`;
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

export function isFromClinicalHistory(from: string | null | undefined): boolean {
  return from === FROM_CLINICAL_HISTORY;
}

export function backHrefFromClinicalSubpage(
  from: string | null | undefined,
  patientId: string,
  defaultHref: string
): string {
  return isFromClinicalHistory(from) ? patientClinicalHistoryPath(patientId) : defaultHref;
}
