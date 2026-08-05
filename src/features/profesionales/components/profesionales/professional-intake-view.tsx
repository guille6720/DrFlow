"use client";

import { Header } from "@/core/components/layout/header";

import { ProfessionalIntakeChecklistCard } from "@/features/profesionales/components/profesionales/professional-intake-checklist-card";
import { ProfessionalIntakeDetailHeader } from "@/features/profesionales/components/profesionales/professional-intake-detail-header";
import { ProfessionalIntakeDetailPanel } from "@/features/profesionales/components/profesionales/professional-intake-detail-panel";
import { ProfessionalIntakeNewForm } from "@/features/profesionales/components/profesionales/professional-intake-new-form";
import { ProfessionalIntakeSidebar } from "@/features/profesionales/components/profesionales/professional-intake-sidebar";
import type { ProfessionalIntakeViewProps } from "@/features/profesionales/components/profesionales/professional-intake-types";
import { useProfessionalIntake } from "@/features/profesionales/hooks/use-professional-intake";

import { Card } from "@/components/ui/card";

export type {
  AvailabilityRuleRow,
  ProfessionalIntakeDetail,
} from "@/features/profesionales/components/profesionales/professional-intake-types";

export function ProfessionalIntakeView({
  clinics,
  clinicId,
  role,
  userName,
  locations,
  professionals,
  scheduleByProfessional,
}: ProfessionalIntakeViewProps) {
  const {
    selectedId,
    isNew,
    selected,
    detailTab,
    setDetailTab,
    newStep,
    setNewStep,
    fieldErrors,
    loading,
    error,
    success,
    showReference,
    setShowReference,
    agendaRules,
    setAgendaRules,
    navigateTo,
    clearError,
    resetNewWizard,
    handleCreateSubmit,
    handleUpdateProfile,
    handleSaveSchedule,
  } = useProfessionalIntake({ professionals, scheduleByProfessional });

  return (
    <>
      <Header
        title="Ingreso de profesionales"
        subtitle="Alta, perfil, consultorio y rangos horarios del equipo médico"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />

      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:gap-6 lg:p-6">
        <ProfessionalIntakeSidebar
          professionals={professionals}
          selectedId={selectedId}
          isNew={isNew}
          onSelect={(id) => navigateTo(id)}
          onNew={() => {
            resetNewWizard();
            navigateTo(null, true);
          }}
        />

        <div className="min-w-0 flex-1 space-y-4">
          {isNew ? (
            <ProfessionalIntakeNewForm
              locations={locations}
              newStep={newStep}
              onStepChange={setNewStep}
              fieldErrors={fieldErrors}
              onClearError={clearError}
              agendaRules={agendaRules}
              onAgendaRulesChange={setAgendaRules}
              loading={loading}
              error={error}
              success={success}
              onSubmit={handleCreateSubmit}
            />
          ) : selected ? (
            <>
              <ProfessionalIntakeDetailHeader
                selected={selected}
                detailTab={detailTab}
                onTabChange={setDetailTab}
              />
              <ProfessionalIntakeDetailPanel
                selected={selected}
                detailTab={detailTab}
                locations={locations}
                fieldErrors={fieldErrors}
                onClearError={clearError}
                agendaRules={agendaRules}
                onAgendaRulesChange={setAgendaRules}
                loading={loading}
                error={error}
                success={success}
                onUpdateProfile={handleUpdateProfile}
                onSaveSchedule={handleSaveSchedule}
              />
            </>
          ) : (
            <Card title="Seleccioná un profesional">
              <p className="text-sm text-slate-600">
                Elegí un profesional del panel izquierdo para editar su perfil, consultorio u
                horarios, o creá uno nuevo.
              </p>
            </Card>
          )}

          <ProfessionalIntakeChecklistCard
            showReference={showReference}
            onToggleReference={() => setShowReference(!showReference)}
          />
        </div>
      </div>
    </>
  );
}
