import { PrescriptionsOrdersHubClient } from "@/features/recetas/components/recetas/prescriptions-orders-hub-client";
import type { PrescriptionsOrdersHubProps } from "@/features/recetas/components/recetas/prescriptions-orders-types";

export function PrescriptionsOrdersHub({
  clinic,
  selectedPatient,
  recentPrescriptions,
}: Pick<
  PrescriptionsOrdersHubProps,
  "clinic" | "selectedPatient" | "recentPrescriptions"
>) {
  return (
    <div className="space-y-4">
      <PrescriptionsOrdersHubClient
        recentPrescriptions={recentPrescriptions}
        clinic={clinic}
        selectedPatient={selectedPatient}
      />
    </div>
  );
}
