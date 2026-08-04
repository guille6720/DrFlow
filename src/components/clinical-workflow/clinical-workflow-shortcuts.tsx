"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { finalizeConsultation } from "@/lib/actions/appointments";
import { isEditableTarget } from "@/lib/utils/command-palette-search";
import {
  parsePatientIdFromPath,
  patientWorkflowHref,
} from "@/lib/utils/clinical-workflow-context";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import { clearConsultationTimer } from "@/components/historias/consultation-timer";

/** Global keyboard shortcuts for patient-centered clinical workflows. */
export function ClinicalWorkflowShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const patientId = parsePatientIdFromPath(pathname);

  const finalizeActiveConsult = useCallback(async () => {
    const appointmentId = searchParams.get("appointment");
    if (!appointmentId || !patientId) return;
    const result = await finalizeConsultation(appointmentId, "presencial");
    if (!result.error) {
      clearConsultationTimer(appointmentId);
      router.push(buildPatientWorkspaceUrl(patientId, { tab: "soap" }));
      router.refresh();
    }
  }, [patientId, router, searchParams]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (patientId && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push(patientWorkflowHref(patientId, "soap"));
        return;
      }

      if (patientId && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        router.push(patientWorkflowHref(patientId, "prescription"));
        return;
      }

      if (patientId && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        router.push(patientWorkflowHref(patientId, "order"));
        return;
      }

      if (patientId && e.shiftKey && e.key === "Enter") {
        const appointmentId = searchParams.get("appointment");
        const action = searchParams.get("action");
        if (appointmentId && action === "nueva") {
          e.preventDefault();
          void finalizeActiveConsult();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [patientId, router, searchParams, finalizeActiveConsult]);

  return null;
}
