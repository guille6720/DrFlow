export type ConsultationModality = "presencial" | "virtual";

export const CONSULTATION_MODALITY_OPTIONS: {
  value: ConsultationModality;
  label: string;
}[] = [
  { value: "presencial", label: "Presencial" },
  { value: "virtual", label: "Virtual" },
];

export function consultationModalityLabel(
  modality: string | null | undefined
): string {
  return (
    CONSULTATION_MODALITY_OPTIONS.find((item) => item.value === modality)?.label ??
    "Presencial"
  );
}

export function parseConsultationModality(
  value: unknown
): ConsultationModality {
  return value === "virtual" ? "virtual" : "presencial";
}
