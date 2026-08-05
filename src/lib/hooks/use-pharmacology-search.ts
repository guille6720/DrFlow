"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  getDrugsByPathology,
  getPathologiesBySymptoms,
} from "@/lib/actions/pharmacology";
import {
  appendToConsultationEvolution,
  consultationDraftKey,
  parseConsultationDraftContext,
} from "@/lib/utils/consultation-draft";
import type {
  PamiVademecumResult,
  PathologyBySymptomResult,
  PathologyDrug,
  PathologySearchResult,
  PharmacologySearchMode,
  SymptomSearchResult,
} from "@/types/pharmacology";

type Options = {
  initialMode?: PharmacologySearchMode;
};

export function usePharmacologySearch({ initialMode = "pathology" }: Options = {}) {
  const searchParams = useSearchParams();
  const consultationContext = useMemo(
    () => parseConsultationDraftContext(searchParams),
    [searchParams]
  );
  const draftKey = useMemo(
    () => (consultationContext ? consultationDraftKey(consultationContext) : null),
    [consultationContext]
  );

  const [mode, setMode] = useState<PharmacologySearchMode>(initialMode);
  const [selected, setSelected] = useState<PathologySearchResult | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomSearchResult[]>([]);
  const [pathologyMatches, setPathologyMatches] = useState<PathologyBySymptomResult[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [drugs, setDrugs] = useState<PathologyDrug[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vademecumItems, setVademecumItems] = useState<PamiVademecumResult[]>([]);
  const [vademecumLoading, setVademecumLoading] = useState(false);
  const [vademecumError, setVademecumError] = useState<string | null>(null);
  const [vademecumQueryLength, setVademecumQueryLength] = useState(0);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);

  function handleAddToEvolution(line: string, itemKey: string) {
    if (!draftKey) return;
    appendToConsultationEvolution(draftKey, line);
    setLastAddedKey(itemKey);
    setAddedMessage("Agregado a la evolución de la consulta");
    window.setTimeout(() => {
      setAddedMessage(null);
      setLastAddedKey(null);
    }, 2500);
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

  function handleClearPathology() {
    setSelected(null);
    setDrugs([]);
    setError(null);
    setLoading(false);
  }

  function loadDrugs(pathology: PathologySearchResult) {
    setSelected(pathology);
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

  function handleSymptomsChange(next: SymptomSearchResult[]) {
    setSymptoms(next);
    handleClearPathology();
    fetchPathologyMatches(next);
  }

  function switchMode(next: PharmacologySearchMode) {
    setMode(next);
    handleClearPathology();
    setSymptoms([]);
    setPathologyMatches([]);
    setMatchesError(null);
    setMatchesLoading(false);
    setVademecumItems([]);
    setVademecumError(null);
    setVademecumLoading(false);
    setVademecumQueryLength(0);
  }

  return {
    consultationContext,
    draftKey,
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
    vademecumItems,
    setVademecumItems,
    vademecumLoading,
    setVademecumLoading,
    vademecumError,
    setVademecumError,
    vademecumQueryLength,
    setVademecumQueryLength,
    addedMessage,
    lastAddedKey,
    handleAddToEvolution,
    handlePathologySelect: loadDrugs,
    handleSymptomPathologySelect: loadDrugs,
    handleClearPathology,
    handleSymptomsChange,
  };
}
