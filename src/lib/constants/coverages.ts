/** Coberturas estándar que el médico puede marcar en Configuración */
export const STANDARD_COVERAGES = [
  "PAMI",
  "OSDE",
  "Swiss Medical",
  "Galeno",
  "IOMA",
  "Medife",
  "Particular",
] as const;

export type StandardCoverage = (typeof STANDARD_COVERAGES)[number];

export function isPamiCoverage(name: string | null | undefined): boolean {
  return (name ?? "").toUpperCase().includes("PAMI");
}

/** ¿La clínica ofrece / se posiciona como PAMI? */
export function clinicOffersPami(
  accepted: string[] | null | undefined,
  practiceProfile?: string | null
): boolean {
  if (practiceProfile === "cabecera_pami") return true;
  if (accepted && accepted.length > 0) {
    return accepted.some((c) => isPamiCoverage(c));
  }
  return false;
}

/** Label del número de afiliado / beneficio según cobertura */
export function insuranceNumberLabel(coverage: string | null | undefined): string {
  return isPamiCoverage(coverage) ? "N° beneficio PAMI" : "N° afiliado";
}

/** Normaliza y deduplica coberturas (trim, sin vacíos, case-insensitive unique) */
export function normalizeCoverages(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

/**
 * Opciones para el select de pacientes.
 * Si la clínica no configuró ninguna, usa la lista estándar.
 */
export function coverageOptionsForClinic(
  accepted: string[] | null | undefined,
  currentValue?: string | null
): string[] {
  const base =
    accepted && accepted.length > 0
      ? normalizeCoverages(accepted)
      : [...STANDARD_COVERAGES];

  const current = currentValue?.trim();
  if (current && !base.some((c) => c.toLowerCase() === current.toLowerCase())) {
    return [...base, current];
  }
  return base;
}

/** Cobertura por defecto razonable para el formulario */
export function resolveDefaultCoverage(
  defaultInsurance: string | null | undefined,
  accepted: string[] | null | undefined,
  patientCoverage?: string | null
): string {
  if (patientCoverage?.trim()) return patientCoverage.trim();

  const options = coverageOptionsForClinic(accepted);
  if (
    defaultInsurance?.trim() &&
    options.some((c) => c.toLowerCase() === defaultInsurance.trim().toLowerCase())
  ) {
    return defaultInsurance.trim();
  }
  return options[0] ?? "";
}
