"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState, useTransition } from "react";

import { buildPacientesSearchUrl } from "@/features/pacientes/utils/pacientes-page-url";

export const PACIENTES_SEARCH_DEBOUNCE_MS = 300;

function normalizeQuery(value: string): string {
  return value.trim();
}

type ScheduledSearch = {
  q: string;
  patologia: string;
};

function searchesMatch(a: ScheduledSearch, b: ScheduledSearch): boolean {
  return normalizeQuery(a.q) === normalizeQuery(b.q) &&
    normalizeQuery(a.patologia) === normalizeQuery(b.patologia);
}

function syncLocalFromUrl(
  urlValue: string,
  syncedValue: string,
  localValue: string
): { synced: string; local: string } {
  if (urlValue === syncedValue) {
    return { synced: syncedValue, local: localValue };
  }

  const prevSynced = syncedValue;
  const nextSynced = urlValue;
  const shouldReplaceLocal = normalizeQuery(localValue) === normalizeQuery(prevSynced);

  return {
    synced: nextSynced,
    local: shouldReplaceLocal ? urlValue : localValue,
  };
}

export function useDebouncedPacientesSearch(
  urlQ: string,
  urlPatologia: string,
  cobertura?: string
) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [query, setQuery] = useState(urlQ);
  const [pathology, setPathology] = useState(urlPatologia);
  const [syncedQ, setSyncedQ] = useState(urlQ);
  const [syncedPatologia, setSyncedPatologia] = useState(urlPatologia);
  const debounceTimerRef = useRef<number | null>(null);
  const latestScheduledRef = useRef<ScheduledSearch | null>(null);
  const skipDebounceUntilSyncRef = useRef(false);

  if (urlQ !== syncedQ) {
    const next = syncLocalFromUrl(urlQ, syncedQ, query);
    setSyncedQ(next.synced);
    if (next.local !== query) setQuery(next.local);
  }

  if (urlPatologia !== syncedPatologia) {
    const next = syncLocalFromUrl(urlPatologia, syncedPatologia, pathology);
    setSyncedPatologia(next.synced);
    if (next.local !== pathology) setPathology(next.local);
  }

  function clearDebounceTimer() {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    latestScheduledRef.current = null;
  }

  const navigateToSearch = useCallback(
    (nextQ: string, nextPatologia: string) => {
      const scheduled: ScheduledSearch = {
        q: normalizeQuery(nextQ),
        patologia: normalizeQuery(nextPatologia),
      };
      const current: ScheduledSearch = {
        q: normalizeQuery(urlQ),
        patologia: normalizeQuery(urlPatologia),
      };
      if (searchesMatch(scheduled, current)) return;

      latestScheduledRef.current = scheduled;
      startTransition(() => {
        router.push(buildPacientesSearchUrl(scheduled.q, cobertura, scheduled.patologia), {
          scroll: false,
        });
      });
    },
    [cobertura, router, urlPatologia, urlQ, startTransition]
  );

  useEffect(() => {
    const scheduled: ScheduledSearch = {
      q: normalizeQuery(query),
      patologia: normalizeQuery(pathology),
    };
    const current: ScheduledSearch = {
      q: normalizeQuery(urlQ),
      patologia: normalizeQuery(urlPatologia),
    };

    if (skipDebounceUntilSyncRef.current) {
      if (searchesMatch(scheduled, current)) {
        skipDebounceUntilSyncRef.current = false;
      }
      clearDebounceTimer();
      return;
    }

    if (searchesMatch(scheduled, current)) {
      clearDebounceTimer();
      return;
    }

    clearDebounceTimer();
    latestScheduledRef.current = scheduled;

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      if (
        !latestScheduledRef.current ||
        !searchesMatch(latestScheduledRef.current, scheduled)
      ) {
        return;
      }
      navigateToSearch(scheduled.q, scheduled.patologia);
    }, PACIENTES_SEARCH_DEBOUNCE_MS);

    return clearDebounceTimer;
  }, [navigateToSearch, pathology, query, urlPatologia, urlQ]);

  function submitSearch(event?: FormEvent) {
    event?.preventDefault();
    clearDebounceTimer();
    skipDebounceUntilSyncRef.current = true;
    navigateToSearch(query, pathology);
  }

  return {
    query,
    setQuery,
    pathology,
    setPathology,
    submitSearch,
    isNavigating,
  };
}
