"use client";

import Link from "next/link";

import { DoctorSetupFields } from "@/core/components/onboarding/doctor-setup-fields";

import { ProfessionalIntakeFormMessages } from "@/features/profesionales/components/profesionales/professional-intake-form-messages";
import { ProfessionalIntakeOfficeFields } from "@/features/profesionales/components/profesionales/professional-intake-office-fields";
import type {
  ProfessionalIntakeDetail,
  ProfessionalIntakeDetailTab,
  ProfessionalIntakeLocation,
} from "@/features/profesionales/components/profesionales/professional-intake-types";
import { getProfessionalSpecialtyDefaults } from "@/features/profesionales/components/profesionales/professional-intake-utils";
import {
  ProfessionalScheduleEditor,
} from "@/features/profesionales/components/profesionales/professional-schedule-editor";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AgendaRuleDraft } from "@/lib/constants/professional-intake-checklist";

type Props = {
  selected: ProfessionalIntakeDetail;
  detailTab: ProfessionalIntakeDetailTab;
  locations: ProfessionalIntakeLocation[];
  fieldErrors: Record<string, string>;
  onClearError: (name: string) => void;
  agendaRules: AgendaRuleDraft[];
  onAgendaRulesChange: (rules: AgendaRuleDraft[]) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  onUpdateProfile: (e: React.FormEvent<HTMLFormElement>) => void;
  onSaveSchedule: () => void;
};

export function ProfessionalIntakeDetailPanel({
  selected,
  detailTab,
  locations,
  fieldErrors,
  onClearError,
  agendaRules,
  onAgendaRulesChange,
  loading,
  error,
  success,
  onUpdateProfile,
  onSaveSchedule,
}: Props) {
  const { parsedName, specialtySelect, specialtyCustom } = getProfessionalSpecialtyDefaults(selected);

  if (detailTab === "horarios") {
    return (
      <Card title="Rangos horarios de atención">
        <ProfessionalScheduleEditor rules={agendaRules} onChange={onAgendaRulesChange} />
        <ProfessionalIntakeFormMessages error={error} success={success} className="mt-4" />
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button type="button" loading={loading} onClick={onSaveSchedule}>
            Guardar horarios
          </Button>
          <Link href="/configuracion?grupo=agenda&seccion=agenda">
            <Button type="button" variant="outline">
              Agenda avanzada
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card title={detailTab === "perfil" ? "Perfil del profesional" : "Consultorio y coberturas"}>
      <form onSubmit={onUpdateProfile} className="space-y-4">
        {detailTab === "perfil" ? (
          <>
            <DoctorSetupFields
              fieldErrors={fieldErrors}
              onClearError={onClearError}
              showSectionTitle={false}
              defaultValues={{
                doctorFirstName: parsedName.first,
                doctorLastName: parsedName.last,
                documentNumber: selected.document_number ?? "",
                phone: selected.phone ?? "",
                specialtySelect,
                specialtyCustom,
                licenseNational: selected.license_national ?? "",
                licenseProvincial: selected.license_provincial ?? "",
              }}
            />
            <Input
              name="email"
              label="Email profesional"
              type="email"
              defaultValue={selected.email ?? ""}
              placeholder="medico@consultorio.com"
            />
          </>
        ) : (
          <ProfessionalIntakeOfficeFields locations={locations} selected={selected} />
        )}

        <ProfessionalIntakeFormMessages error={error} success={success} />

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button type="submit" loading={loading}>
            Guardar cambios
          </Button>
          <Link href="/configuracion?grupo=consultorio&seccion=equipo">
            <Button type="button" variant="outline">
              Invitar al equipo
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
