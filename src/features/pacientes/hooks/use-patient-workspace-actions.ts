"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import {
  buildPatientWorkspaceUrl,
  parsePatientWorkspaceActions,
  type PatientWorkspaceUrlOptions,
} from "@/features/pacientes/utils/patient-workspace-actions";

type WorkspaceNavigation = {
  workspaceSearchParams: URLSearchParams;
  navigateWorkspace: (opts: PatientWorkspaceUrlOptions) => void;
};

export function usePatientWorkspaceActions(
  patientId: string,
  activeTab: PatientWorkspaceTabId,
  navigation?: WorkspaceNavigation
) {
  const router = useRouter();
  const fallbackSearchParams = useSearchParams();
  const searchParams = navigation?.workspaceSearchParams ?? fallbackSearchParams;

  const parsed = useMemo(
    () => parsePatientWorkspaceActions(activeTab, searchParams),
    [activeTab, searchParams]
  );

  const navigate = useCallback(
    (opts: PatientWorkspaceUrlOptions) => {
      if (navigation) {
        navigation.navigateWorkspace(opts);
        return;
      }
      router.push(buildPatientWorkspaceUrl(patientId, opts), { scroll: false });
    },
    [navigation, patientId, router]
  );

  const closeSheet = useCallback(() => {
    if (parsed.inlineConsultOpen) {
      navigate({
        tab: "soap",
        action: "nueva",
        appointment: parsed.appointment ?? undefined,
        professional: parsed.professional ?? undefined,
      });
      return;
    }
    if (parsed.sheet === "receta" || parsed.sheet === "orden") {
      navigate({
        tab: "soap",
        consulta: parsed.consulta ?? undefined,
      });
      return;
    }
    navigate({ tab: activeTab });
  }, [
    activeTab,
    navigate,
    parsed.appointment,
    parsed.consulta,
    parsed.inlineConsultOpen,
    parsed.professional,
    parsed.sheet,
  ]);

  const openNewConsult = useCallback(
    (opts?: { appointment?: string; professional?: string }) => {
      navigate({
        tab: "soap",
        action: "nueva",
        appointment: opts?.appointment,
        professional: opts?.professional,
      });
    },
    [navigate]
  );

  const openNewPrescription = useCallback(
    (opts?: { consulta?: string; professional?: string }) => {
      navigate({
        tab: "recetas",
        action: "nueva",
        consulta: opts?.consulta,
        professional: opts?.professional,
      });
    },
    [navigate]
  );

  const openNewOrder = useCallback(
    (opts?: { consulta?: string; professional?: string }) => {
      navigate({
        tab: "ordenes",
        action: "nueva",
        consulta: opts?.consulta,
        professional: opts?.professional,
      });
    },
    [navigate]
  );

  const openRecord = useCallback(
    (recordId: string, mode?: "edit" | "view") => {
      if (mode === "edit") {
        navigate({
          tab: "soap",
          record: recordId,
          mode: "edit",
        });
        return;
      }
      navigate({ tab: "soap", consulta: recordId });
    },
    [navigate]
  );

  const onConsultSaved = useCallback(
    (recordId: string) => {
      navigate({ tab: "soap", consulta: recordId });
      router.refresh();
    },
    [navigate, router]
  );

  const onRxOrOrderSaved = useCallback(() => {
    closeSheet();
    router.refresh();
  }, [closeSheet, router]);

  return {
    ...parsed,
    closeSheet,
    openNewConsult,
    openNewPrescription,
    openNewOrder,
    openRecord,
    onConsultSaved,
    onRxOrOrderSaved,
    buildUrl: (opts: PatientWorkspaceUrlOptions) => buildPatientWorkspaceUrl(patientId, opts),
  };
}
