"use client";

import { useEffect, useRef, useState } from "react";

import { logClientError } from "@/core/errors";

import {
  fetchPatientSearchResults,
  PATIENT_SEARCH_DEBOUNCE_MS,
  shouldExecutePatientSearch,
} from "@/features/pacientes/utils/fetch-patient-search";

import { type CommandPalettePatientHit, mapPatientHits } from "@/lib/utils/command-palette-search";

export function useCommandPalettePatientSearch(open: boolean, query: string) {
  const [patientHits, setPatientHits] = useState<CommandPalettePatientHit[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    if (!shouldExecutePatientSearch(q)) {
      abortRef.current?.abort();
      const resetTimer = setTimeout(() => {
        setPatientHits([]);
        setLoadingPatients(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const loadingTimer = window.setTimeout(() => {
      setLoadingPatients(true);
      setPatientHits([]);
    }, 0);

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      void fetchPatientSearchResults(q, { signal: controller.signal })
        .then(({ patients }) => {
          if (controller.signal.aborted) return;
          setPatientHits(mapPatientHits(patients));
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          logClientError("command-palette.patient-search", err, { query: q });
          setPatientHits([]);
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setLoadingPatients(false);
        });
    }, PATIENT_SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      window.clearTimeout(loadingTimer);
    };
  }, [open, query]);

  return { patientHits, loadingPatients, setPatientHits };
}
