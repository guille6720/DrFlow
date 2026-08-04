import { MEDICAL_SPECIALTIES, SPECIALTY_OTHER_VALUE } from "@/lib/constants/medical-specialties";
import { parseDisplayName } from "@/features/profesionales/components/profesionales/professional-schedule-editor";
import type { ProfessionalIntakeDetail } from "@/features/profesionales/components/profesionales/professional-intake-types";

export function getProfessionalSpecialtyDefaults(selected: ProfessionalIntakeDetail | null) {
  const specialtyDefault = selected?.specialties?.name ?? "";
  const specialtyInList = MEDICAL_SPECIALTIES.includes(
    specialtyDefault as (typeof MEDICAL_SPECIALTIES)[number]
  );

  return {
    parsedName: parseDisplayName(selected?.display_name ?? null),
    specialtySelect: specialtyInList
      ? specialtyDefault
      : specialtyDefault
        ? SPECIALTY_OTHER_VALUE
        : "",
    specialtyCustom: specialtyInList ? "" : specialtyDefault,
  };
}
