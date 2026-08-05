"use client";

import { PrescriptionsOrdersPatientSearch } from "@/features/recetas/components/recetas/prescriptions-orders-patient-search";
import { PrescriptionsOrdersRecentList } from "@/features/recetas/components/recetas/prescriptions-orders-recent-list";
import type { PrescriptionsOrdersHubProps } from "@/features/recetas/components/recetas/prescriptions-orders-types";
import { usePrescriptionsOrdersHub } from "@/features/recetas/hooks/use-prescriptions-orders-hub";

type Props = Pick<
  PrescriptionsOrdersHubProps,
  "patients" | "recentPrescriptions" | "clinic" | "selectedPatient"
>;

/** Client islands for patient search and recent prescription navigation. */
export function PrescriptionsOrdersHubClient({
  patients,
  recentPrescriptions,
  clinic,
  selectedPatient,
}: Props) {
  const { navigate } = usePrescriptionsOrdersHub({
    defaultTab: "receta",
    selectedPatientId: selectedPatient?.id,
  });

  return (
    <>
      <PrescriptionsOrdersPatientSearch
        patients={patients}
        selectedPatientId={selectedPatient?.id}
        onPatientChange={(id) => navigate(id)}
      />
      {!selectedPatient ? (
        <PrescriptionsOrdersRecentList
          recentPrescriptions={recentPrescriptions}
          clinic={clinic}
          onSelectPatient={(id) => navigate(id)}
        />
      ) : null}
    </>
  );
}
