import {
  type ClinicalFavoriteDiagnosisPayload,
  type ClinicalFavoriteMedicationPayload,
  type ClinicalFavoriteRow,
  type ClinicalFavoriteTreatmentPayload,
  diagnosisFavoriteFingerprint,
  medicationFavoriteFingerprint,
  treatmentFavoriteFingerprint,
} from "@/features/historias/types/clinical-favorites";
import type { ClinicalRecentUsageRow } from "@/features/historias/types/clinical-recent-usage";

export type PrioritizedDiagnosisHit =
  | { source: "favorite"; key: string; payload: ClinicalFavoriteDiagnosisPayload }
  | { source: "recent"; key: string; payload: ClinicalFavoriteDiagnosisPayload }
  | { source: "separator"; key: string }
  | { source: "catalog"; key: string; catalogId: string; payload: ClinicalFavoriteDiagnosisPayload };

export function buildPrioritizedDiagnosisHits(args: {
  favorites: ClinicalFavoriteRow[];
  recent: ClinicalRecentUsageRow[];
  catalog: Array<{
    id: string;
    name: string;
    cie10_code: string | null;
    cie11_code?: string | null;
    snomed_code?: string | null;
  }>;
}): PrioritizedDiagnosisHit[] {
  const seen = new Set<string>();

  function markSeen(payload: ClinicalFavoriteDiagnosisPayload) {
    seen.add(diagnosisFavoriteFingerprint(payload));
    // También por nombre+CIE para evitar duplicar catálogo vs favorito libre.
    seen.add(
      diagnosisFavoriteFingerprint({
        name: payload.name,
        cie10_code: payload.cie10_code,
        clinical_diagnosis_id: null,
      })
    );
  }

  function alreadySeen(payload: ClinicalFavoriteDiagnosisPayload): boolean {
    const byId = diagnosisFavoriteFingerprint(payload);
    const byName = diagnosisFavoriteFingerprint({
      name: payload.name,
      cie10_code: payload.cie10_code,
      clinical_diagnosis_id: null,
    });
    return seen.has(byId) || seen.has(byName);
  }

  const favoriteItems: PrioritizedDiagnosisHit[] = args.favorites.map((favorite) => {
    const raw = favorite.payload as ClinicalFavoriteDiagnosisPayload;
    const payload: ClinicalFavoriteDiagnosisPayload = {
      name: raw.name?.trim() || favorite.label,
      cie10_code: raw.cie10_code ?? null,
      cie11_code: raw.cie11_code ?? null,
      snomed_code: raw.snomed_code ?? null,
      clinical_diagnosis_id: raw.clinical_diagnosis_id ?? null,
    };
    markSeen(payload);
    return { source: "favorite", key: `fav:${favorite.id}`, payload };
  });

  const recentItems: PrioritizedDiagnosisHit[] = [];
  for (const row of args.recent) {
    const raw = row.payload as ClinicalFavoriteDiagnosisPayload;
    const payload: ClinicalFavoriteDiagnosisPayload = {
      name: raw.name?.trim() || row.label,
      cie10_code: raw.cie10_code ?? null,
      cie11_code: raw.cie11_code ?? null,
      snomed_code: raw.snomed_code ?? null,
      clinical_diagnosis_id: raw.clinical_diagnosis_id ?? null,
    };
    if (alreadySeen(payload)) continue;
    markSeen(payload);
    recentItems.push({ source: "recent", key: `rec:${row.id}`, payload });
  }

  const catalogItems: PrioritizedDiagnosisHit[] = [];
  for (const item of args.catalog) {
    const payload: ClinicalFavoriteDiagnosisPayload = {
      name: item.name,
      cie10_code: item.cie10_code,
      cie11_code: item.cie11_code ?? null,
      snomed_code: item.snomed_code ?? null,
      clinical_diagnosis_id: item.id,
    };
    if (alreadySeen(payload)) continue;
    markSeen(payload);
    catalogItems.push({
      source: "catalog",
      key: `cat:${item.id}`,
      catalogId: item.id,
      payload,
    });
  }

  const prioritized = [...favoriteItems, ...recentItems];
  if (prioritized.length > 0 && catalogItems.length > 0) {
    return [...prioritized, { source: "separator", key: "sep" }, ...catalogItems];
  }
  return [...prioritized, ...catalogItems];
}

export function treatmentPayloadFingerprint(payload: ClinicalFavoriteTreatmentPayload): string {
  return treatmentFavoriteFingerprint(payload);
}

export function medicationPayloadFingerprint(payload: ClinicalFavoriteMedicationPayload): string {
  return medicationFavoriteFingerprint(payload);
}
