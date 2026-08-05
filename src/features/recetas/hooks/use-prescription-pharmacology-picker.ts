"use client";

import { useState } from "react";

import { getDrugsByPathology, getPathologiesBySymptoms } from "@/lib/actions/pharmacology";
import type {
  PathologyBySymptomResult,
  PathologyDrug,
  PathologySearchResult,
  PharmacologySearchMode,
  SymptomSearchResult,
} from "@/types/pharmacology";

type Options = {
  onPathologySelect: (pathology: PathologySearchResult) => void;
};

export function usePrescriptionPharmacologyPicker({ onPathologySelect }: Options) {
  const [mode, setMode] = useState<PharmacologySearchMode>("pathology");
  const [selected, setSelected] = useState<PathologySearchResult | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomSearchResult[]>([]);
  const [pathologyMatches, setPathologyMatches] = useState<PathologyBySymptomResult[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [drugs, setDrugs] = useState<PathologyDrug[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearPathologySelection() {
    setSelected(null);
    setDrugs([]);
    setError(null);
    setLoading(false);
  }

  function loadDrugs(pathology: PathologySearchResult) {
    setSelected(pathology);
    onPathologySelect(pathology);
    setLoading(true);
    setError(null);

    getDrugsByPathology(pathology.id).then((res) => {
      setLoading(false);
      if (res.error) {
        setError(res.error);
        setDrugs([]);
      } else {
        setDrugs(res.data ?? []);
      }
    });
  }

  function fetchPathologyMatches(nextSymptoms: SymptomSearchResult[]) {
    if (nextSymptoms.length === 0) {
      setPathologyMatches([]);
      setMatchesError(null);
      setMatchesLoading(false);
      return;
    }

    setMatchesLoading(true);
    setMatchesError(null);

    getPathologiesBySymptoms(nextSymptoms.map((s) => s.id)).then((res) => {
      setMatchesLoading(false);
      if (res.error) {
        setMatchesError(res.error);
        setPathologyMatches([]);
      } else {
        setPathologyMatches(res.data ?? []);
      }
    });
  }

  function handleSymptomsChange(next: SymptomSearchResult[]) {
    setSymptoms(next);
    clearPathologySelection();
    fetchPathologyMatches(next);
  }

  function switchMode(next: PharmacologySearchMode) {
    setMode(next);
    clearPathologySelection();
    setSymptoms([]);
    setPathologyMatches([]);
    setMatchesError(null);
    setMatchesLoading(false);
  }

  return {
    mode,
    switchMode,
    selected,
    symptoms,
    pathologyMatches,
    matchesLoading,
    matchesError,
    drugs,
    loading,
    error,
    loadDrugs,
    clearPathologySelection,
    handleSymptomsChange,
  };
}
