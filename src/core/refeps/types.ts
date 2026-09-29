import type { ElectronicPrescription } from "@/types/prescription";

export type RefepsClinicSettings = {
  enabled: boolean;
  establishmentCode: string | null;
  autoSubmit: boolean;
};

/** Legacy status for prescriptions registered by the pre-refactor adapter (kept for historical records). */
export function isRefepsSubmitted(
  prescription: Pick<ElectronicPrescription, "refeps_status">
): boolean {
  return prescription.refeps_status === "submitted";
}
