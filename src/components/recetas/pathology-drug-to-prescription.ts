import type { PathologyDrug } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

function resolveDrug(pd: PathologyDrug) {
  return Array.isArray(pd.drugs) ? pd.drugs[0] : pd.drugs;
}

export function pathologyDrugToPrescription(pd: PathologyDrug): PrescriptionMedication | null {
  const drug = resolveDrug(pd);
  if (!drug) return null;
  return {
    generic_name: drug.active_ingredient || drug.name,
    brand_name: drug.name !== drug.active_ingredient ? drug.name : "",
    presentation: drug.presentation ?? "",
    concentration: "",
    quantity: 1,
    posology: pd.dosage_reference ?? "",
    route: drug.route ?? "oral",
  };
}
