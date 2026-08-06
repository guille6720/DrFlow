import type { PrescriptionMedication } from "@/types/prescription";

export const emptyPrescriptionMedication = (): PrescriptionMedication => ({
  generic_name: "",
  brand_name: "",
  presentation: "",
  concentration: "",
  quantity: 1,
  posology: "",
  route: "oral",
});

export function appendPrescriptionMedication(
  prev: PrescriptionMedication[],
  med: PrescriptionMedication
): PrescriptionMedication[] {
  const hasOnlyEmpty =
    prev.length === 1 && !prev[0].generic_name.trim() && !prev[0].posology.trim();
  if (hasOnlyEmpty) return [med];
  return [...prev, med];
}
