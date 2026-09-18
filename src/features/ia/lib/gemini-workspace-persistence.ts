import type { CopilotChatTurn } from "@/features/ia/hooks/use-clinical-copilot-chat";

import type { GeminiStatsPatient } from "@/lib/ai/gemini-structured-response";

export type GeminiSearchHistoryEntry = {
  id: string;
  query: string;
  at: string;
  patientCount: number;
  patients: GeminiStatsPatient[];
  summary?: string;
};

export type GeminiWorkspaceSnapshot = {
  turns: CopilotChatTurn[];
  searchHistory: GeminiSearchHistoryEntry[];
  activeHistoryId: string | null;
};

const STORAGE_KEY_PREFIX = "drflow:gemini-workspace:v1";
const LEGACY_GLOBAL_KEY = "drflow:gemini-workspace:v1";
const MAX_HISTORY = 12;
const MAX_TURNS = 40;

export type GeminiWorkspaceScope = {
  clinicId: string;
  /** Use `_clinic` when no patient is selected (clinic-level search UI). */
  patientId: string;
};

/** Namespaced sessionStorage key — isolates AI state per clinic + patient. */
export function geminiWorkspaceStorageKey(scope: GeminiWorkspaceScope): string {
  const clinicId = scope.clinicId.trim() || "_unknown_clinic";
  const patientId = scope.patientId.trim() || "_clinic";
  return `${STORAGE_KEY_PREFIX}:${clinicId}:${patientId}`;
}

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function emptySnapshot(): GeminiWorkspaceSnapshot {
  return { turns: [], searchHistory: [], activeHistoryId: null };
}

function parseSnapshot(raw: string | null): GeminiWorkspaceSnapshot {
  if (!raw) return emptySnapshot();
  try {
    const parsed = JSON.parse(raw) as Partial<GeminiWorkspaceSnapshot>;
    return {
      turns: Array.isArray(parsed.turns)
        ? parsed.turns.filter(
            (t) => t && (t.role === "user" || t.role === "assistant") && !t.pending
          )
        : [],
      searchHistory: Array.isArray(parsed.searchHistory)
        ? parsed.searchHistory.slice(0, MAX_HISTORY)
        : [],
      activeHistoryId: typeof parsed.activeHistoryId === "string" ? parsed.activeHistoryId : null,
    };
  } catch {
    return emptySnapshot();
  }
}

export function loadGeminiWorkspaceSnapshot(
  scope?: GeminiWorkspaceScope | null
): GeminiWorkspaceSnapshot {
  if (!canUseSessionStorage()) return emptySnapshot();
  try {
    if (!scope?.clinicId) {
      // No clinic context yet — do not read the legacy global key (cross-patient leak).
      return emptySnapshot();
    }
    const key = geminiWorkspaceStorageKey({
      clinicId: scope.clinicId,
      patientId: scope.patientId || "_clinic",
    });
    const scoped = window.sessionStorage.getItem(key);
    if (scoped) return parseSnapshot(scoped);

    // One-time migration: clinic-level bucket may inherit non-PHI search history from legacy key.
    if ((scope.patientId || "_clinic") === "_clinic") {
      const legacy = window.sessionStorage.getItem(LEGACY_GLOBAL_KEY);
      if (legacy) {
        const parsed = parseSnapshot(legacy);
        // Drop chat turns from legacy global — they may contain patient-specific AI text.
        const migrated: GeminiWorkspaceSnapshot = {
          turns: [],
          searchHistory: parsed.searchHistory,
          activeHistoryId: parsed.activeHistoryId,
        };
        window.sessionStorage.setItem(key, JSON.stringify(migrated));
        window.sessionStorage.removeItem(LEGACY_GLOBAL_KEY);
        return migrated;
      }
    }
    return emptySnapshot();
  } catch {
    return emptySnapshot();
  }
}

export function saveGeminiWorkspaceSnapshot(
  snapshot: GeminiWorkspaceSnapshot,
  scope?: GeminiWorkspaceScope | null
): void {
  if (!canUseSessionStorage() || !scope?.clinicId) return;
  try {
    const key = geminiWorkspaceStorageKey({
      clinicId: scope.clinicId,
      patientId: scope.patientId || "_clinic",
    });
    const payload: GeminiWorkspaceSnapshot = {
      turns: snapshot.turns.filter((t) => !t.pending).slice(-MAX_TURNS),
      searchHistory: snapshot.searchHistory.slice(0, MAX_HISTORY),
      activeHistoryId: snapshot.activeHistoryId,
    };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearGeminiWorkspaceSnapshot(scope?: GeminiWorkspaceScope | null): void {
  if (!canUseSessionStorage()) return;
  try {
    if (scope?.clinicId) {
      window.sessionStorage.removeItem(
        geminiWorkspaceStorageKey({
          clinicId: scope.clinicId,
          patientId: scope.patientId || "_clinic",
        })
      );
    }
    window.sessionStorage.removeItem(LEGACY_GLOBAL_KEY);
  } catch {
    /* ignore */
  }
}

export function upsertGeminiSearchHistory(
  history: GeminiSearchHistoryEntry[],
  entry: Omit<GeminiSearchHistoryEntry, "id" | "at"> & { id?: string; at?: string }
): GeminiSearchHistoryEntry[] {
  const nextEntry: GeminiSearchHistoryEntry = {
    id: entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at ?? new Date().toISOString(),
    query: entry.query.trim(),
    patientCount: entry.patientCount,
    patients: entry.patients.slice(0, 200),
    summary: entry.summary,
  };

  const withoutDup = history.filter(
    (item) => item.query.trim().toLowerCase() !== nextEntry.query.toLowerCase()
  );
  return [nextEntry, ...withoutDup].slice(0, MAX_HISTORY);
}
