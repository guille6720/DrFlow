"use client";

import { useEffect, useState } from "react";

import { searchPathologies } from "@/lib/actions/pharmacology";
import type { PathologySearchResult } from "@/types/pharmacology";

type Options = {
  query: string;
  minLength?: number;
  debounceMs?: number;
};

/** Búsqueda CIE-10 con debounce — evita setState síncrono en effects. */
export function useDeferredPathologySearch({
  query,
  minLength = 2,
  debounceMs = 350,
}: Options) {
  const [pathologies, setPathologies] = useState<PathologySearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < minLength) {
      const resetTimer = window.setTimeout(() => {
        setPathologies([]);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    let cancelled = false;
    const searchTimer = window.setTimeout(async () => {
      setLoading(true);
      const { data } = await searchPathologies(query);
      if (!cancelled) {
        setPathologies(data ?? []);
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(searchTimer);
    };
  }, [query, minLength, debounceMs]);

  return { pathologies, loading };
}
