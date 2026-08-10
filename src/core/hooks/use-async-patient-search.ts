"use client";

import { useEffect, useRef, useState } from "react";

import { logClientError } from "@/core/errors";
import { PATIENT_SEARCH_API_LIMIT } from "@/core/supabase/pagination";

import type { PatientSearchOption } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import {
  fetchPatientSearchResults,
  PATIENT_SEARCH_DEBOUNCE_MS,
  resolvePatientSearchMinLength,
  shouldExecutePatientSearch,
} from "@/features/pacientes/utils/fetch-patient-search";

type Options = {
  minLength?: number;
  cobertura?: "pami";
  enabled?: boolean;
  limit?: number;
};

/** Debounced patient search against `/api/patients/search` with request cancellation. */
export function useAsyncPatientSearch(query: string, options: Options = {}) {
  const { minLength = 2, cobertura, enabled = true, limit = PATIENT_SEARCH_API_LIMIT } = options;
  const [results, setResults] = useState<PatientSearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const trimmed = query.trim();
    const effectiveMin = resolvePatientSearchMinLength(trimmed, minLength);

    if (!shouldExecutePatientSearch(trimmed, effectiveMin)) {
      abortRef.current?.abort();
      abortRef.current = null;
      const resetTimer = setTimeout(() => {
        setResults([]);
        setLoading(false);
        setError(null);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const loadingTimer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      void fetchPatientSearchResults(trimmed, {
        cobertura,
        limit,
        extended: true,
        signal: controller.signal,
      })
        .then(({ patients, error: fetchError }) => {
          if (controller.signal.aborted) return;
          setResults(patients);
          setError(fetchError ?? null);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          logClientError("async-patient-search", err, { query: trimmed });
          setResults([]);
          setError("No se pudo buscar pacientes.");
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setLoading(false);
        });
    }, PATIENT_SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      window.clearTimeout(loadingTimer);
    };
  }, [query, minLength, cobertura, enabled, limit]);

  return { results, loading, error };
}
