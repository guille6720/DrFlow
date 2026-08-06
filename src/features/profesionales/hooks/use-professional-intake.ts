"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  AvailabilityRuleRow,
  ProfessionalIntakeDetail,
  ProfessionalIntakeDetailTab,
  ProfessionalIntakeNewStep,
} from "@/features/profesionales/components/profesionales/professional-intake-types";
import { normalizeAgendaRules } from "@/features/profesionales/components/profesionales/professional-schedule-editor";

import {
  saveProfessionalSchedule,
  submitProfessionalIntake,
  updateProfessionalBankDetails,
  updateProfessionalProfile,
} from "@/lib/actions/professional-intake";
import {
  AGENDA_PRESETS,
  type AgendaRuleDraft,
} from "@/lib/constants/professional-intake-checklist";

type Params = {
  professionals: ProfessionalIntakeDetail[];
  scheduleByProfessional: Record<string, AvailabilityRuleRow[]>;
};

export function useProfessionalIntake({ professionals, scheduleByProfessional }: Params) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedId = searchParams.get("id");
  const isNew =
    searchParams.get("nuevo") === "1" || (!selectedId && professionals.length === 0);

  const selected = useMemo(
    () => professionals.find((p) => p.id === selectedId) ?? null,
    [professionals, selectedId]
  );

  const [detailTab, setDetailTab] = useState<ProfessionalIntakeDetailTab>("perfil");
  const [newStep, setNewStep] = useState<ProfessionalIntakeNewStep>("ficha");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [agendaRules, setAgendaRules] = useState<AgendaRuleDraft[]>(
    AGENDA_PRESETS[0].rules.map((r) => ({ ...r }))
  );
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(selected?.id ?? null);

  if ((selected?.id ?? null) !== prevSelectedId) {
    setPrevSelectedId(selected?.id ?? null);
    const rows = selected ? (scheduleByProfessional[selected.id] ?? []) : [];
    setAgendaRules(
      rows.length > 0
        ? normalizeAgendaRules(rows)
        : AGENDA_PRESETS[0].rules.map((r) => ({ ...r }))
    );
    setDetailTab("perfil");
    setError(null);
    setSuccess(null);
  }

  function navigateTo(id: string | null, nuevo = false) {
    const params = new URLSearchParams();
    if (nuevo) params.set("nuevo", "1");
    else if (id) params.set("id", id);
    const qs = params.toString();
    router.push(qs ? `/ingreso-profesionales?${qs}` : "/ingreso-profesionales");
  }

  function clearError(name: string) {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function resetNewWizard() {
    setNewStep("ficha");
    setAgendaRules(AGENDA_PRESETS[0].rules.map((r) => ({ ...r })));
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    formData.set("agenda_rules_json", JSON.stringify(agendaRules));

    const result = await submitProfessionalIntake(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(result.message ?? "Profesional registrado.");
    if (result.professionalId) navigateTo(result.professionalId);
    else router.refresh();
  }

  async function handleUpdateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await updateProfessionalProfile(selected.id, new FormData(e.currentTarget));
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(result.message ?? "Datos actualizados.");
    router.refresh();
  }

  async function handleUpdateBankDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await updateProfessionalBankDetails(
      selected.id,
      new FormData(e.currentTarget)
    );
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(result.message ?? "Datos bancarios actualizados.");
    router.refresh();
  }

  async function handleSaveSchedule() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("agenda_rules_json", JSON.stringify(agendaRules));
    const result = await saveProfessionalSchedule(selected.id, formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(result.message ?? "Horarios guardados.");
    router.refresh();
  }

  return {
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
    handleUpdateBankDetails,
    handleSaveSchedule,
  };
}
