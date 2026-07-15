/** Parse texto libre de medicación habitual en filas de receta. */
export function parseHabitualMedicationText(
  text: string | null | undefined
): import("@/types/prescription").PrescriptionMedication[] {
  if (!text?.trim()) return [];

  const lines = text
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line) => {
    // "Enalapril 10 mg" / "Metformina 850mg 1 comp cada 12hs"
    const match = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|UI|ml|%|ui)?)(.*)$/i);
    if (match) {
      return {
        generic_name: match[1].trim(),
        brand_name: "",
        presentation: "",
        concentration: match[2].trim(),
        quantity: 1,
        posology: (match[3] ?? "").trim() || "Según indicación médica",
        route: "oral",
      };
    }
    return {
      generic_name: line,
      brand_name: "",
      presentation: "",
      concentration: "",
      quantity: 1,
      posology: "Según indicación médica",
      route: "oral",
    };
  });
}
