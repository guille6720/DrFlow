/** Etiqueta informativa de consultas clínicas acumuladas por paciente. */
export function formatPatientConsultationCount(count: number): string {
  if (count <= 0) return "Sin consultas registradas";
  if (count === 1) return "1 consulta realizada";
  return `${count} consultas realizadas`;
}

/** Versión compacta para filas del listado de pacientes. */
export function formatPatientConsultationCountShort(count: number): string {
  if (count <= 0) return "Sin consultas";
  if (count === 1) return "1 consulta";
  return `${count} consultas`;
}
