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
