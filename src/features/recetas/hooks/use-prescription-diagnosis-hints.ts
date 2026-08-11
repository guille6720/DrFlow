"use client";

import { useEffect, useState } from "react";

import { getDrugsByPathology } from "@/lib/actions/pharmacology";
import { useDeferredPathologySearch } from "@/lib/hooks/use-deferred-pathology-search";
import type { PathologyDrug } from "@/types/pharmacology";

type Options = {
  diagnosisText: string;
  enabled?: boolean;
};

type FetchState = {
  pathologyId: string;
  drugs: PathologyDrug[];
};

/** Ayuda contextual por diagnóstico — sugerencias, sin auto-selección. */
export function usePrescriptionDiagnosisHints({ diagnosisText, enabled = true }: Options) {
  const query = diagnosisText.trim();
  const { pathologies, loading: searching } = useDeferredPathologySearch({
    query,
    minLength: 3,
    debounceMs: 400,
  });

  const activePathology =
    enabled && query.length >= 3 && pathologies.length > 0 ? pathologies[0] : null;

  const [fetchState, setFetchState] = useState<FetchState | null>(null);

  useEffect(() => {
    if (!activePathology?.id) return;

    let cancelled = false;
    void getDrugsByPathology(activePathology.id).then(({ data }) => {
      if (cancelled) return;
      setFetchState({ pathologyId: activePathology.id, drugs: data ?? [] });
    });

    return () => {
      cancelled = true;
    };
  }, [activePathology?.id]);

  const pathologyName = activePathology?.name ?? null;
  const activePathologyId = activePathology?.id ?? null;
  const drugs =
    activePathologyId && fetchState?.pathologyId === activePathologyId ? fetchState.drugs : [];
  const loadingDrugs = Boolean(activePathologyId) && fetchState?.pathologyId !== activePathologyId;

  return {
    pathologyName,
    drugs,
    loading: searching || loadingDrugs,
    hasHints: Boolean(pathologyName && drugs.length > 0),
  };
}
