"use client";

import { useEffect, useRef, useState } from "react";

import { logClientError } from "@/core/errors";
import { PATIENT_SEARCH_API_LIMIT } from "@/core/supabase/pagination";

import type { PatientSearchOption } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import { normalizePatientSearchResult } from "@/features/pacientes/utils/patient-search-result";

type ApiPatient = PatientSearchOption & {
  label?: string;
  description?: string;
  insurance_number?: string | null;
  phone?: string | null;
  address?: string | null;
  birth_date?: string | null;
  insurance_provider?: string | null;
};

type Options = {
  minLength?: number;
  cobertura?: "pami";
  enabled?: boolean;
  limit?: number;
};

/** Debounced patient search against `/api/command-palette/patients`. */
export function useAsyncPatientSearch(query: string, options: Options = {}) {
  const { minLength = 2, cobertura, enabled = true, limit = PATIENT_SEARCH_API_LIMIT } = options;
  const [results, setResults] = useState<ApiPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const q = query.trim();
    if (q.length < minLength) {
      const resetTimer = setTimeout(() => {
        setResults([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    if (fetchRef.current) clearTimeout(fetchRef.current);
    const loadingTimer = window.setTimeout(() => setLoading(true), 0);

    fetchRef.current = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (cobertura) params.set("cobertura", cobertura);
      params.set("limit", String(limit));
      params.set("format", "picker");
      params.set("extended", "1");

      void fetch(`/api/command-palette/patients?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : { patients: [] }))
        .then((data: { patients?: ApiPatient[] }) => {
          setResults((data.patients ?? []).map(normalizePatientSearchResult));
        })
        .catch((err) => {
          logClientError("async-patient-search", err, { query: q });
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 200);

    return () => {
      if (fetchRef.current) clearTimeout(fetchRef.current);
      window.clearTimeout(loadingTimer);
    };
  }, [query, minLength, cobertura, enabled, limit]);

  return { results, loading };
}
