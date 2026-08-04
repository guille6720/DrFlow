"use client";

import { PrescriptionsOrdersConsultationBanner } from "@/features/recetas/components/recetas/prescriptions-orders-consultation-banner";
import { PrescriptionsOrdersFormPanel } from "@/features/recetas/components/recetas/prescriptions-orders-form-panel";
import { PrescriptionsOrdersPatientHeader } from "@/features/recetas/components/recetas/prescriptions-orders-patient-header";
import { PrescriptionsOrdersPatientSearch } from "@/features/recetas/components/recetas/prescriptions-orders-patient-search";
import { PrescriptionsOrdersPatientSidebar } from "@/features/recetas/components/recetas/prescriptions-orders-patient-sidebar";
import { PrescriptionsOrdersRecentList } from "@/features/recetas/components/recetas/prescriptions-orders-recent-list";
import { PrescriptionsOrdersTabBar } from "@/features/recetas/components/recetas/prescriptions-orders-tab-bar";
import type { PrescriptionsOrdersHubProps } from "@/features/recetas/components/recetas/prescriptions-orders-types";
import { usePrescriptionsOrdersHub } from "@/features/recetas/hooks/use-prescriptions-orders-hub";

export function PrescriptionsOrdersHub({
  patients,
  professionals,
  clinic,
  selectedPatient,
  patientPrescriptions,
  patientOrders,
  recentPrescriptions,
  prefillDiagnosis = "",
  prefillCie10 = "",
  initialMedications,
  defaultProfessionalId,
  defaultTab,
}: PrescriptionsOrdersHubProps) {
  const {
    router,
    consultationContext,
    draftKey,
    consultaMedications,
    diagnosisForForm,
    medicationsForForm,
    activeTab,
    navigate,
    setTab,
  } = usePrescriptionsOrdersHub({
    prefillDiagnosis,
    initialMedications,
    defaultTab,
    selectedPatientId: selectedPatient?.id,
  });

  return (
    <div className="space-y-4">
      {consultationContext ? (
        <PrescriptionsOrdersConsultationBanner
          consultationContext={consultationContext}
          consultaMedicationsCount={consultaMedications.length}
        />
      ) : null}

      <PrescriptionsOrdersPatientSearch
        patients={patients}
        selectedPatientId={selectedPatient?.id}
        onPatientChange={(id) => navigate(id, activeTab)}
      />

      {selectedPatient ? (
        <>
          <PrescriptionsOrdersPatientHeader patient={selectedPatient} />
          <PrescriptionsOrdersTabBar activeTab={activeTab} onTabChange={setTab} />

          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,340px)]">
            <PrescriptionsOrdersFormPanel
              activeTab={activeTab}
              patient={selectedPatient}
              professionals={professionals}
              defaultProfessionalId={defaultProfessionalId}
              consultationContext={consultationContext}
              draftKey={draftKey}
              consultaMedicationsCount={consultaMedications.length}
              initialMedications={initialMedications}
              diagnosisForForm={diagnosisForForm}
              medicationsForForm={medicationsForForm}
              prefillCie10={prefillCie10}
              onPrescriptionSuccess={() => router.refresh()}
              onOrderSuccess={() => router.refresh()}
            />
            <PrescriptionsOrdersPatientSidebar
              patient={selectedPatient}
              clinic={clinic}
              patientPrescriptions={patientPrescriptions}
              patientOrders={patientOrders}
            />
          </div>
        </>
      ) : (
        <PrescriptionsOrdersRecentList
          recentPrescriptions={recentPrescriptions}
          clinic={clinic}
          onSelectPatient={(id) => navigate(id)}
        />
      )}
    </div>
  );
}
