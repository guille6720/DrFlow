import type {
  ClinicalFavoriteKind,
  ClinicalFavoritePayload,
} from "@/features/historias/types/clinical-favorites";

/** Uso reciente del profesional: solo término clínico, sin vínculo a pacientes. */
export type ClinicalRecentUsageRow = {
  id: string;
  user_id: string;
  kind: ClinicalFavoriteKind;
  fingerprint: string;
  label: string;
  payload: ClinicalFavoritePayload;
  last_used_at: string;
  use_count: number;
  created_at: string;
};
