/** Coberturas estándar que el médico puede marcar en Configuración */
export const STANDARD_COVERAGES = [
  "PAMI",
  "OSDE",
  "Swiss Medical",
  "Galeno",
  "Medifé",
  "IOMA",
  "OMINT",
  "Medicus",
  "Sancor Salud",
  "OSECAC",
  "OSPLAD",
  "Hospital Italiano",
  "Accord Salud",
  "Particular",
] as const;

/** Obras sociales y prepagas frecuentes para turnos y fichas */
export const INSURANCE_PROVIDERS = STANDARD_COVERAGES;

export const INSURANCE_PLANS_BY_PROVIDER: Record<string, readonly string[]> = {
  PAMI: ["PMO", "Plan Especial", "Plan Nuevo"],
  OSDE: ["210", "310", "410", "450", "510", "610", "710", "Binario"],
  "Swiss Medical": ["SMG10", "SMG20", "SMG30", "SMG40", "SMG50", "SMG60", "SMG70"],
  Galeno: ["Clásico", "Oro", "Platinum", "Azul"],
  Medifé: ["Clásico", "Family", "Integra", "Pleno"],
  IOMA: ["Plan básico", "Plan especial"],
  OMINT: ["400", "500", "600", "700", "Premium"],
  Medicus: ["Blanco", "Azul", "Rojo", "Verde", "Celeste"],
  "Sancor Salud": ["1000", "2000", "3000", "4000"],
  OSECAC: ["Convenio"],
  OSPLAD: ["Plan básico"],
  "Hospital Italiano": ["HI", "HIM", "HII"],
  "Accord Salud": ["Clásico", "Superior"],
  Particular: ["Particular"],
};

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

function appendCurrentOption(options: string[], currentValue?: string | null): string[] {
  const current = currentValue?.trim();
  if (current && !options.some((option) => option.toLowerCase() === current.toLowerCase())) {
    return [...options, current];
  }
  return options;
}

/** Opciones de obra social para selects (incluye valor actual si no está en catálogo). */
export function insuranceProviderOptions(currentValue?: string | null): string[] {
  return appendCurrentOption([...INSURANCE_PROVIDERS], currentValue);
}

/** Planes disponibles para la obra social elegida. */
export function insurancePlanOptionsForProvider(
  provider: string | null | undefined,
  currentPlan?: string | null
): string[] {
  const trimmed = provider?.trim();
  if (!trimmed) return [];

  const key = Object.keys(INSURANCE_PLANS_BY_PROVIDER).find(
    (entry) => entry.toLowerCase() === trimmed.toLowerCase()
  );
  const base = key ? [...INSURANCE_PLANS_BY_PROVIDER[key]!] : ["Standard"];
  return appendCurrentOption(base, currentPlan);
}

/** Primer plan sugerido al cambiar de obra social. */
export function defaultInsurancePlanForProvider(provider: string | null | undefined): string {
  const options = insurancePlanOptionsForProvider(provider);
  return options[0] ?? "";
}
