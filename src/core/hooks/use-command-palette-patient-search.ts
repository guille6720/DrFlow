"use client";

import { useEffect, useRef, useState } from "react";
import type { CommandPalettePatientHit } from "@/lib/utils/command-palette-search";

export function useCommandPalettePatientSearch(open: boolean, query: string) {
  const [patientHits, setPatientHits] = useState<CommandPalettePatientHit[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    if (q.length < 2) {
      const resetTimer = setTimeout(() => {
        setPatientHits([]);
        setLoadingPatients(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    if (fetchRef.current) clearTimeout(fetchRef.current);
    const loadingTimer = window.setTimeout(() => setLoadingPatients(true), 0);
    fetchRef.current = setTimeout(() => {
      void fetch(`/api/command-palette/patients?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { patients: [] }))
        .then((data: { patients?: CommandPalettePatientHit[] }) => {
          setPatientHits(data.patients ?? []);
        })
        .catch(() => setPatientHits([]))
        .finally(() => setLoadingPatients(false));
    }, 200);

    return () => {
      if (fetchRef.current) clearTimeout(fetchRef.current);
      window.clearTimeout(loadingTimer);
    };
  }, [open, query]);

  return { patientHits, loadingPatients, setPatientHits };
}
