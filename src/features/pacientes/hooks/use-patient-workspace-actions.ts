"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import {
  buildPatientWorkspaceUrl,
  parsePatientWorkspaceActions,
  type PatientWorkspaceUrlOptions,
} from "@/features/pacientes/utils/patient-workspace-actions";

export function usePatientWorkspaceActions(patientId: string, activeTab: PatientWorkspaceTabId) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const parsed = useMemo(
    () => parsePatientWorkspaceActions(activeTab, searchParams),
    [activeTab, searchParams]
  );

  const navigate = useCallback(
    (opts: PatientWorkspaceUrlOptions) => {
      router.push(buildPatientWorkspaceUrl(patientId, opts), { scroll: false });
    },
    [patientId, router]
  );

  const closeSheet = useCallback(() => {
    router.push(buildPatientWorkspaceUrl(patientId, { tab: activeTab }), { scroll: false });
  }, [activeTab, patientId, router]);

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
      navigate({
        tab: "soap",
        record: recordId,
        mode: mode ?? "view",
      });
    },
    [navigate]
  );

  const onConsultSaved = useCallback(
    (recordId: string) => {
      navigate({ tab: "soap", record: recordId, mode: "view" });
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
