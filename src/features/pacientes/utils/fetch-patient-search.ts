"use client";

import type { PatientSearchOption } from "@/features/pacientes/components/pacientes/patient-search-combobox";
import {
  PATIENT_SEARCH_DEBOUNCE_MS,
  resolvePatientSearchMinLength,
  shouldExecutePatientSearch,
} from "@/features/pacientes/utils/patient-search-query";
import { normalizePatientSearchResult } from "@/features/pacientes/utils/patient-search-result";

type FetchPatientSearchOptions = {
  cobertura?: "pami";
  limit?: number;
  extended?: boolean;
  signal?: AbortSignal;
};

type FetchPatientSearchResult = {
  patients: PatientSearchOption[];
  error?: string;
};

/** Shared client fetch for patient search APIs. */
export async function fetchPatientSearchResults(
  query: string,
  options: FetchPatientSearchOptions = {}
): Promise<FetchPatientSearchResult> {
  const trimmed = query.trim();
  if (!shouldExecutePatientSearch(trimmed)) {
    return { patients: [] };
  }

  const params = new URLSearchParams({ q: trimmed });
  if (options.cobertura) params.set("cobertura", options.cobertura);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.extended) params.set("extended", "1");

  const response = await fetch(`/api/patients/search?${params.toString()}`, {
    signal: options.signal,
  });

  if (response.status === 401 || response.status === 403) {
    return { patients: [], error: "No tenés permiso para buscar pacientes." };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return { patients: [], error: body?.error ?? "No se pudo buscar pacientes." };
  }

  const data = (await response.json()) as {
    patients?: Array<PatientSearchOption & { label?: string; description?: string }>;
  };

  return {
    patients: (data.patients ?? []).map(normalizePatientSearchResult),
  };
}

export { PATIENT_SEARCH_DEBOUNCE_MS, resolvePatientSearchMinLength, shouldExecutePatientSearch };
