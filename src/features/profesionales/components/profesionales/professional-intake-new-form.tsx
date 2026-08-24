"use client";

import { UserPlus } from "lucide-react";

import { PlanCapHint } from "@/core/components/entitlements/plan-cap-hint";
import { DoctorSetupFields } from "@/core/components/onboarding/doctor-setup-fields";
import { FEATURES } from "@/core/entitlements/features";

import { cn } from "@/shared/utils/cn";

import { ProfessionalIntakeFormMessages } from "@/features/profesionales/components/profesionales/professional-intake-form-messages";
import { ProfessionalIntakeOfficeFields } from "@/features/profesionales/components/profesionales/professional-intake-office-fields";
import {
  PROFESSIONAL_INTAKE_NEW_STEPS,
  type ProfessionalIntakeLocation,
  type ProfessionalIntakeNewStep,
} from "@/features/profesionales/components/profesionales/professional-intake-types";
import {
  ProfessionalScheduleEditor,
} from "@/features/profesionales/components/profesionales/professional-schedule-editor";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AgendaRuleDraft } from "@/lib/constants/professional-intake-checklist";

type Props = {
  locations: ProfessionalIntakeLocation[];
  newStep: ProfessionalIntakeNewStep;
  onStepChange: (step: ProfessionalIntakeNewStep) => void;
  fieldErrors: Record<string, string>;
  onClearError: (name: string) => void;
  agendaRules: AgendaRuleDraft[];
  onAgendaRulesChange: (rules: AgendaRuleDraft[]) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function ProfessionalIntakeNewForm({
  locations,
  newStep,
  onStepChange,
  fieldErrors,
  onClearError,
  agendaRules,
  onAgendaRulesChange,
  loading,
  error,
  success,
  onSubmit,
}: Props) {
  const newStepIndex = PROFESSIONAL_INTAKE_NEW_STEPS.findIndex((s) => s.id === newStep);

  return (
    <Card title="Alta de profesional" className="border-teal-100">
      <PlanCapHint feature={FEATURES.PROFESSIONALS_MAX} />
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
        {PROFESSIONAL_INTAKE_NEW_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onStepChange(s.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              newStep === s.id
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {newStep === "ficha" ? (
          <div className="space-y-4">
            <DoctorSetupFields
              fieldErrors={fieldErrors}
              onClearError={onClearError}
              showSectionTitle={false}
            />
            <Input
              name="email"
              label="Email profesional"
              type="email"
              placeholder="medico@consultorio.com"
            />
          </div>
        ) : null}

        {newStep === "consultorio" ? (
          <div className="space-y-4">
            <ProfessionalIntakeOfficeFields locations={locations} />
          </div>
        ) : null}

        {newStep === "agenda" ? (
          <ProfessionalScheduleEditor rules={agendaRules} onChange={onAgendaRulesChange} />
        ) : null}

        <ProfessionalIntakeFormMessages error={error} success={success} />

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {newStepIndex > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onStepChange(PROFESSIONAL_INTAKE_NEW_STEPS[newStepIndex - 1].id)}
            >
              Anterior
            </Button>
          ) : null}
          {newStepIndex < PROFESSIONAL_INTAKE_NEW_STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => onStepChange(PROFESSIONAL_INTAKE_NEW_STEPS[newStepIndex + 1].id)}
            >
              Siguiente
            </Button>
          ) : (
            <Button type="submit" loading={loading}>
              <UserPlus className="h-4 w-4" />
              Registrar profesional
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
