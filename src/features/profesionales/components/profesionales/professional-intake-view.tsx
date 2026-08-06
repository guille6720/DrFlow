"use client";

import { Header } from "@/core/components/layout/header";

import { ClinicTeamMemberDetailPanel } from "@/features/profesionales/components/profesionales/clinic-team-member-detail-panel";
import { ProfessionalIntakeChecklistCard } from "@/features/profesionales/components/profesionales/professional-intake-checklist-card";
import { ProfessionalIntakeDetailHeader } from "@/features/profesionales/components/profesionales/professional-intake-detail-header";
import { ProfessionalIntakeDetailPanel } from "@/features/profesionales/components/profesionales/professional-intake-detail-panel";
import { ProfessionalIntakeNewForm } from "@/features/profesionales/components/profesionales/professional-intake-new-form";
import { ProfessionalIntakeSidebar } from "@/features/profesionales/components/profesionales/professional-intake-sidebar";
import type { ProfessionalIntakeViewProps } from "@/features/profesionales/components/profesionales/professional-intake-types";
import { useClinicTeamMemberPanel } from "@/features/profesionales/hooks/use-clinic-team-member-panel";
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
  teamMembers,
  scheduleByProfessional,
}: ProfessionalIntakeViewProps) {
  const {
    selectedId,
    selectedMemberId,
    isNew,
    selected,
    selectedMember,
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
    navigateToMember,
    clearError,
    resetNewWizard,
    handleCreateSubmit,
    handleUpdateProfile,
    handleUpdateBankDetails,
    handleSaveSchedule,
  } = useProfessionalIntake({ professionals, teamMembers, scheduleByProfessional });

  const memberPanel = useClinicTeamMemberPanel(selectedMember);

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
          teamMembers={teamMembers}
          selectedId={selectedId}
          selectedMemberId={selectedMemberId}
          isNew={isNew}
          onSelect={(id) => navigateTo(id)}
          onSelectMember={(memberId) => navigateToMember(memberId)}
          onNew={() => {
            resetNewWizard();
            navigateTo(null, true);
          }}
        />

        <div className="min-w-0 flex-1 space-y-4">
          {selectedMember ? (
            <ClinicTeamMemberDetailPanel
              member={selectedMember}
              acting={memberPanel.acting}
              loading={memberPanel.loading}
              error={memberPanel.error}
              success={memberPanel.success}
              onSubmitProfile={memberPanel.handleSubmitProfile}
              onRoleChange={memberPanel.handleRoleChange}
              onDeactivate={memberPanel.handleDeactivate}
              onRemove={memberPanel.handleRemove}
            />
          ) : isNew ? (
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
                onUpdateBankDetails={handleUpdateBankDetails}
                onSaveSchedule={handleSaveSchedule}
              />
            </>
          ) : (
            <Card title="Seleccioná un profesional o usuario">
              <p className="text-sm text-slate-600">
                Elegí un profesional o un usuario invitado del panel izquierdo para editar sus
                datos, o creá un profesional nuevo.
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
