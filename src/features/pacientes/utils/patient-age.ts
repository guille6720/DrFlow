import { differenceInYears, parseISO, isValid } from "date-fns";

export function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const date = parseISO(birthDate);
  if (!isValid(date)) return null;
  return differenceInYears(new Date(), date);
}

export function formatAgeLabel(birthDate: string | null | undefined): string | null {
  const age = calculateAge(birthDate);
  if (age === null) return null;
  return `${age} años`;
}

export function isPamiPatient(insuranceProvider: string | null | undefined): boolean {
  if (!insuranceProvider) return false;
  return insuranceProvider.trim().toUpperCase().includes("PAMI");
}
