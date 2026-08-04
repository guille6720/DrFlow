"use client";

import { Header } from "@/components/layout/header";
import { DrugTreatmentList } from "@/components/pharmacology/drug-treatment-list";
import { PharmacologyConsultationBanner } from "@/components/pharmacology/pharmacology-consultation-banner";
import { PharmacologySearchInputPanel } from "@/components/pharmacology/pharmacology-search-input-panel";
import { PharmacologySearchModeTabs } from "@/components/pharmacology/pharmacology-search-mode-tabs";
import { VademecumResultList } from "@/components/pharmacology/vademecum-result-list";
import { usePharmacologySearch } from "@/lib/hooks/use-pharmacology-search";
import {
  formatVademecumForEvolution,
  pathologyDrugToEvolutionLine,
} from "@/lib/utils/consultation-draft";
import type { PharmacologySearchMode } from "@/types/pharmacology";
import type { Clinic, UserRole } from "@/types/database";

interface Props {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  initialMode?: PharmacologySearchMode;
}

export function PharmacologySearchView({
  clinics,
  clinicId,
  role,
  userName,
  initialMode = "pathology",
}: Props) {
  const search = usePharmacologySearch({ initialMode });

  return (
    <>
      <Header
        title="Guía farmacológica"
        subtitle="Patología CIE-10, síntomas o vademécum PAMI"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />

      {search.consultationContext && (
        <PharmacologyConsultationBanner
          consultationContext={search.consultationContext}
          addedMessage={search.addedMessage}
        />
      )}

      <div className="space-y-6 p-4 sm:p-6">
        <PharmacologySearchModeTabs mode={search.mode} onSwitchMode={search.switchMode} />

        <PharmacologySearchInputPanel
          mode={search.mode}
          selected={search.selected}
          symptoms={search.symptoms}
          pathologyMatches={search.pathologyMatches}
          matchesLoading={search.matchesLoading}
          matchesError={search.matchesError}
          onPathologySelect={search.handlePathologySelect}
          onClearPathology={search.handleClearPathology}
          onSymptomsChange={search.handleSymptomsChange}
          onSymptomPathologySelect={search.handleSymptomPathologySelect}
          onVademecumResults={search.setVademecumItems}
          onVademecumLoading={search.setVademecumLoading}
          onVademecumError={search.setVademecumError}
          onVademecumQueryChange={search.setVademecumQueryLength}
        />

        {search.mode === "vademecum" ? (
          <VademecumResultList
            items={search.vademecumItems}
            loading={search.vademecumLoading}
            error={search.vademecumError}
            queryLength={search.vademecumQueryLength}
            onAddToEvolution={
              search.draftKey
                ? (item) =>
                    search.handleAddToEvolution(
                      formatVademecumForEvolution(item),
                      `vademecum-${item.id}`
                    )
                : undefined
            }
            lastAddedKey={search.lastAddedKey}
          />
        ) : (
          <DrugTreatmentList
            items={search.selected ? search.drugs : []}
            loading={search.selected ? search.loading : false}
            error={search.selected ? search.error : null}
            pathologyName={search.selected?.name}
            cie10Code={search.selected?.cie10_code}
            searchMode={search.mode === "symptoms" ? "symptoms" : "pathology"}
            onAddToEvolution={
              search.draftKey
                ? (pd) => {
                    const line = pathologyDrugToEvolutionLine(pd);
                    if (line) search.handleAddToEvolution(line, `drug-${pd.id}`);
                  }
                : undefined
            }
            lastAddedKey={search.lastAddedKey}
          />
        )}
      </div>
    </>
  );
}
