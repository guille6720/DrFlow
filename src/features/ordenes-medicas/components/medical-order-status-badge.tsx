import { MEDICAL_ORDER_STATUS_LABELS, type MedicalOrderStatusV2 } from "@/features/ordenes-medicas/constants";

import { Badge } from "@/components/ui/badge";

const VARIANT: Record<MedicalOrderStatusV2, "success" | "warning" | "danger"> = {
  issued: "success",
  draft: "warning",
  void: "danger",
};

export function MedicalOrderStatusBadge({ status }: { status: MedicalOrderStatusV2 }) {
  return <Badge variant={VARIANT[status] ?? "warning"}>{MEDICAL_ORDER_STATUS_LABELS[status] ?? status}</Badge>;
}
