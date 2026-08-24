"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addDiagnosisFavorite,
  addMedicationFavorite,
  addTreatmentFavorite,
  listClinicalFavorites,
  removeClinicalFavoriteByFingerprint,
} from "@/features/historias/actions/clinical-favorites";
import {
  listClinicalRecentUsage,
  recordDiagnosisRecentUsage,
  recordMedicationRecentUsage,
  recordTreatmentRecentUsage,
} from "@/features/historias/actions/clinical-recent-usage";
import {
  type ClinicalFavoriteDiagnosisPayload,
  type ClinicalFavoriteKind,
  type ClinicalFavoriteMedicationPayload,
  type ClinicalFavoriteRow,
  type ClinicalFavoriteTreatmentPayload,
  diagnosisFavoriteFingerprint,
  medicationFavoriteFingerprint,
  normalizeFavoriteText,
  treatmentFavoriteFingerprint,
} from "@/features/historias/types/clinical-favorites";
import type { ClinicalRecentUsageRow } from "@/features/historias/types/clinical-recent-usage";

type ClinicalFavoritesContextValue = {
  loading: boolean;
  favorites: ClinicalFavoriteRow[];
  recent: ClinicalRecentUsageRow[];
  byKind: (kind: ClinicalFavoriteKind) => ClinicalFavoriteRow[];
  recentByKind: (kind: ClinicalFavoriteKind) => ClinicalRecentUsageRow[];
  isFavorite: (kind: ClinicalFavoriteKind, fingerprint: string) => boolean;
  matchingFavorites: (kind: ClinicalFavoriteKind, query: string) => ClinicalFavoriteRow[];
  matchingRecent: (kind: ClinicalFavoriteKind, query: string) => ClinicalRecentUsageRow[];
  toggleDiagnosisFavorite: (payload: ClinicalFavoriteDiagnosisPayload) => Promise<void>;
  toggleTreatmentFavorite: (payload: ClinicalFavoriteTreatmentPayload) => Promise<void>;
  toggleMedicationFavorite: (payload: ClinicalFavoriteMedicationPayload) => Promise<void>;
  rememberDiagnosisUsage: (payload: ClinicalFavoriteDiagnosisPayload) => Promise<void>;
  rememberTreatmentUsage: (payload: ClinicalFavoriteTreatmentPayload) => Promise<void>;
  rememberMedicationUsage: (payload: ClinicalFavoriteMedicationPayload) => Promise<void>;
  refresh: () => Promise<void>;
};

const ClinicalFavoritesContext = createContext<ClinicalFavoritesContextValue | null>(null);

export function ClinicalFavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<ClinicalFavoriteRow[]>([]);
  const [recent, setRecent] = useState<ClinicalRecentUsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [favRes, recentRes] = await Promise.all([
      listClinicalFavorites(),
      listClinicalRecentUsage(),
    ]);
    if (!favRes.error) setFavorites(favRes.data ?? []);
    if (!recentRes.error) setRecent(recentRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [favRes, recentRes] = await Promise.all([
        listClinicalFavorites(),
        listClinicalRecentUsage(),
      ]);
      if (cancelled) return;
      /* Bootstrap async de favoritos/recientes del profesional al montar. */
      if (!favRes.error) setFavorites(favRes.data ?? []);
      if (!recentRes.error) setRecent(recentRes.data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byKind = useCallback(
    (kind: ClinicalFavoriteKind) => favorites.filter((f) => f.kind === kind),
    [favorites]
  );

  const recentByKind = useCallback(
    (kind: ClinicalFavoriteKind) => recent.filter((r) => r.kind === kind),
    [recent]
  );

  const isFavorite = useCallback(
    (kind: ClinicalFavoriteKind, fingerprint: string) =>
      favorites.some((f) => f.kind === kind && f.fingerprint === fingerprint),
    [favorites]
  );

  const matchingFavorites = useCallback(
    (kind: ClinicalFavoriteKind, query: string) => {
      const q = normalizeFavoriteText(query);
      const rows = byKind(kind);
      if (!q) return rows;
      return rows.filter((f) => normalizeFavoriteText(f.label).includes(q));
    },
    [byKind]
  );

  const matchingRecent = useCallback(
    (kind: ClinicalFavoriteKind, query: string) => {
      const q = normalizeFavoriteText(query);
      const favoriteFingerprints = new Set(byKind(kind).map((f) => f.fingerprint));
      const rows = recentByKind(kind).filter((r) => !favoriteFingerprints.has(r.fingerprint));
      if (!q) return rows;
      return rows.filter((r) => normalizeFavoriteText(r.label).includes(q));
    },
    [byKind, recentByKind]
  );

  const toggleDiagnosisFavorite = useCallback(
    async (payload: ClinicalFavoriteDiagnosisPayload) => {
      const fingerprint = diagnosisFavoriteFingerprint(payload);
      if (isFavorite("diagnosis", fingerprint)) {
        await removeClinicalFavoriteByFingerprint("diagnosis", fingerprint);
      } else {
        await addDiagnosisFavorite(payload);
      }
      await refresh();
    },
    [isFavorite, refresh]
  );

  const toggleTreatmentFavorite = useCallback(
    async (payload: ClinicalFavoriteTreatmentPayload) => {
      const fingerprint = treatmentFavoriteFingerprint(payload);
      if (isFavorite("treatment", fingerprint)) {
        await removeClinicalFavoriteByFingerprint("treatment", fingerprint);
      } else {
        await addTreatmentFavorite(payload);
      }
      await refresh();
    },
    [isFavorite, refresh]
  );

  const toggleMedicationFavorite = useCallback(
    async (payload: ClinicalFavoriteMedicationPayload) => {
      const fingerprint = medicationFavoriteFingerprint(payload);
      if (isFavorite("medication", fingerprint)) {
        await removeClinicalFavoriteByFingerprint("medication", fingerprint);
      } else {
        await addMedicationFavorite(payload);
      }
      await refresh();
    },
    [isFavorite, refresh]
  );

  const rememberDiagnosisUsage = useCallback(
    async (payload: ClinicalFavoriteDiagnosisPayload) => {
      await recordDiagnosisRecentUsage(payload);
      await refresh();
    },
    [refresh]
  );

  const rememberTreatmentUsage = useCallback(
    async (payload: ClinicalFavoriteTreatmentPayload) => {
      await recordTreatmentRecentUsage(payload);
      await refresh();
    },
    [refresh]
  );

  const rememberMedicationUsage = useCallback(
    async (payload: ClinicalFavoriteMedicationPayload) => {
      await recordMedicationRecentUsage(payload);
      await refresh();
    },
    [refresh]
  );

  const value = useMemo(
    () => ({
      loading,
      favorites,
      recent,
      byKind,
      recentByKind,
      isFavorite,
      matchingFavorites,
      matchingRecent,
      toggleDiagnosisFavorite,
      toggleTreatmentFavorite,
      toggleMedicationFavorite,
      rememberDiagnosisUsage,
      rememberTreatmentUsage,
      rememberMedicationUsage,
      refresh,
    }),
    [
      loading,
      favorites,
      recent,
      byKind,
      recentByKind,
      isFavorite,
      matchingFavorites,
      matchingRecent,
      toggleDiagnosisFavorite,
      toggleTreatmentFavorite,
      toggleMedicationFavorite,
      rememberDiagnosisUsage,
      rememberTreatmentUsage,
      rememberMedicationUsage,
      refresh,
    ]
  );

  return (
    <ClinicalFavoritesContext.Provider value={value}>{children}</ClinicalFavoritesContext.Provider>
  );
}

export function useClinicalFavorites(): ClinicalFavoritesContextValue {
  const ctx = useContext(ClinicalFavoritesContext);
  if (!ctx) {
    throw new Error("useClinicalFavorites debe usarse dentro de ClinicalFavoritesProvider");
  }
  return ctx;
}

/** Variante segura cuando el provider puede no estar montado. */
export function useClinicalFavoritesOptional(): ClinicalFavoritesContextValue | null {
  return useContext(ClinicalFavoritesContext);
}
