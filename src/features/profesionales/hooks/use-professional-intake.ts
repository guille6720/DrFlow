"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import type { ProfessionalListItem } from "@/features/profesionales/components/profesionales/professional-intake-sidebar";
import type {
  AvailabilityRuleRow,
  ProfessionalIntakeDetail,
  ProfessionalIntakeDetailTab,
  ProfessionalIntakeNewStep,
} from "@/features/profesionales/components/profesionales/professional-intake-types";
import { normalizeAgendaRules } from "@/features/profesionales/components/profesionales/professional-schedule-editor";
import { loadProfessionalIntakeDetailPanel } from "@/features/profesionales/server/load-professional-intake-detail-panel";

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
import type { EnrichedTeamMember } from "@/lib/utils/team-member-display";

type Params = {
  sidebarProfessionals: ProfessionalListItem[];
  initialSelectedProfessional: ProfessionalIntakeDetail | null;
  initialScheduleRules: AvailabilityRuleRow[];
  teamMembers: EnrichedTeamMember[];
};

type SelectionState = {
  selectedId: string | null;
  selectedMemberId: string | null;
  isNew: boolean;
};

type TabSearchParams = {
  get(name: string): string | null;
};

function intakePath(params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `/ingreso-profesionales?${qs}` : "/ingreso-profesionales";
}

function readSelection(searchParams: TabSearchParams, sidebarCount: number): SelectionState {
  const selectedId = searchParams.get("id");
  const selectedMemberId = searchParams.get("miembro");
  const isNew =
    searchParams.get("nuevo") === "1" ||
    (!selectedId && !selectedMemberId && sidebarCount === 0);
  return { selectedId, selectedMemberId, isNew };
}

function rulesFromRows(rows: AvailabilityRuleRow[]): AgendaRuleDraft[] {
  return rows.length > 0
    ? normalizeAgendaRules(rows)
    : AGENDA_PRESETS[0].rules.map((r) => ({ ...r }));
}

export function useProfessionalIntake({
  sidebarProfessionals,
  initialSelectedProfessional,
  initialScheduleRules,
  teamMembers,
}: Params) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selection, setSelection] = useState<SelectionState>(() =>
    readSelection(searchParams, sidebarProfessionals.length)
  );

  const { selectedId, selectedMemberId, isNew } = selection;

  const [selected, setSelected] = useState<ProfessionalIntakeDetail | null>(initialSelectedProfessional);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const selectedMember = useMemo(
    () => teamMembers.find((m) => m.id === selectedMemberId) ?? null,
    [teamMembers, selectedMemberId]
  );

  const [detailTab, setDetailTab] = useState<ProfessionalIntakeDetailTab>("perfil");
  const [newStep, setNewStep] = useState<ProfessionalIntakeNewStep>("ficha");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [agendaRules, setAgendaRules] = useState<AgendaRuleDraft[]>(rulesFromRows(initialScheduleRules));

  const replaceSelection = useCallback((next: SelectionState) => {
    setSelection(next);
    const params = new URLSearchParams();
    if (next.isNew) params.set("nuevo", "1");
    else if (next.selectedMemberId) params.set("miembro", next.selectedMemberId);
    else if (next.selectedId) params.set("id", next.selectedId);
    window.history.replaceState(window.history.state, "", intakePath(params));
  }, []);

  const loadProfessionalDetail = useCallback(
    (professionalId: string) => {
      if (initialSelectedProfessional?.id === professionalId) {
        setSelected(initialSelectedProfessional);
        setAgendaRules(rulesFromRows(initialScheduleRules));
        setDetailTab("perfil");
        setError(null);
        setSuccess(null);
        setDetailError(null);
        return;
      }

      setDetailLoading(true);
      setDetailError(null);
      startTransition(async () => {
        const result = await loadProfessionalIntakeDetailPanel(professionalId);
        setDetailLoading(false);

        if (result.error || !result.professional) {
          setDetailError(result.error ?? "No se pudo cargar el profesional");
          setSelected(null);
          return;
        }

        setSelected(result.professional);
        setAgendaRules(rulesFromRows(result.rules ?? []));
        setDetailTab("perfil");
        setError(null);
        setSuccess(null);
      });
    },
    [initialScheduleRules, initialSelectedProfessional]
  );

  useEffect(() => {
    const onPopState = () => {
      const next = readSelection(new URLSearchParams(window.location.search), sidebarProfessionals.length);
      setSelection(next);
      if (next.selectedId && !next.selectedMemberId && !next.isNew) {
        loadProfessionalDetail(next.selectedId);
      } else {
        setSelected(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [loadProfessionalDetail, sidebarProfessionals.length]);

  function navigateTo(id: string | null, nuevo = false) {
    replaceSelection({
      selectedId: nuevo ? null : id,
      selectedMemberId: null,
      isNew: nuevo,
    });

    if (nuevo || !id) {
      setSelected(null);
      setDetailError(null);
      return;
    }

    loadProfessionalDetail(id);
  }

  function navigateToMember(memberId: string) {
    replaceSelection({
      selectedId: null,
      selectedMemberId: memberId,
      isNew: false,
    });
    setSelected(null);
    setDetailError(null);
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
    selectedMemberId,
    isNew,
    selected,
    selectedMember,
    detailTab,
    setDetailTab,
    newStep,
    setNewStep,
    fieldErrors,
    loading: loading || detailLoading || pending,
    error: error ?? detailError,
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
  };
}
