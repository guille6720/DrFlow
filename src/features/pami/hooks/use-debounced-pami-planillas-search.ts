"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState, useTransition } from "react";

import { buildPamiPlanillasUrl } from "@/features/pami/server/load-pami-planillas-page";

/** Debounce alineado con pacientes (300 ms) — dentro del rango 300–500 ms pedido. */
export const PAMI_PLANILLAS_SEARCH_DEBOUNCE_MS = 300;

function normalizeQuery(value: string): string {
  return value.trim();
}

function buildSearchHref(query: string): string {
  const normalized = normalizeQuery(query);
  return normalized ? buildPamiPlanillasUrl(normalized, 1) : "/pami/planillas";
}

export function useDebouncedPamiPlanillasSearch(searchQuery: string) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [q, setQ] = useState(searchQuery);
  const [syncedQuery, setSyncedQuery] = useState(searchQuery);
  const debounceTimerRef = useRef<number | null>(null);
  const latestScheduledQueryRef = useRef<string | null>(null);
  const skipDebounceUntilSyncRef = useRef(false);

  if (searchQuery !== syncedQuery) {
    setSyncedQuery(searchQuery);
    setQ(searchQuery);
  }

  function clearDebounceTimer() {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    latestScheduledQueryRef.current = null;
  }

  const navigateToQuery = useCallback((query: string) => {
    const normalized = normalizeQuery(query);
    if (normalized === normalizeQuery(searchQuery)) return;

    latestScheduledQueryRef.current = normalized;
    startTransition(() => {
      router.push(buildSearchHref(normalized), { scroll: false });
    });
  }, [router, searchQuery, startTransition]);

  useEffect(() => {
    const normalizedInput = normalizeQuery(q);
    const normalizedUrl = normalizeQuery(searchQuery);

    if (skipDebounceUntilSyncRef.current) {
      if (normalizedInput === normalizedUrl) {
        skipDebounceUntilSyncRef.current = false;
      }
      clearDebounceTimer();
      return;
    }

    if (normalizedInput === normalizedUrl) {
      clearDebounceTimer();
      return;
    }

    clearDebounceTimer();
    const scheduled = normalizedInput;
    latestScheduledQueryRef.current = scheduled;

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      if (latestScheduledQueryRef.current !== scheduled) return;
      navigateToQuery(scheduled);
    }, PAMI_PLANILLAS_SEARCH_DEBOUNCE_MS);

    return clearDebounceTimer;
  }, [navigateToQuery, q, searchQuery]);

  function submitSearch(event?: FormEvent) {
    event?.preventDefault();
    clearDebounceTimer();
    skipDebounceUntilSyncRef.current = true;
    navigateToQuery(q);
  }

  return { q, setQ, submitSearch, isNavigating };
}
