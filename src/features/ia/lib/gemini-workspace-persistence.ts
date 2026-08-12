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

const STORAGE_KEY = "drflow:gemini-workspace:v1";
const MAX_HISTORY = 12;
const MAX_TURNS = 40;

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function loadGeminiWorkspaceSnapshot(): GeminiWorkspaceSnapshot {
  if (!canUseSessionStorage()) {
    return { turns: [], searchHistory: [], activeHistoryId: null };
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { turns: [], searchHistory: [], activeHistoryId: null };
    const parsed = JSON.parse(raw) as Partial<GeminiWorkspaceSnapshot>;
    return {
      turns: Array.isArray(parsed.turns)
        ? parsed.turns.filter((t) => t && (t.role === "user" || t.role === "assistant") && !t.pending)
        : [],
      searchHistory: Array.isArray(parsed.searchHistory) ? parsed.searchHistory.slice(0, MAX_HISTORY) : [],
      activeHistoryId: typeof parsed.activeHistoryId === "string" ? parsed.activeHistoryId : null,
    };
  } catch {
    return { turns: [], searchHistory: [], activeHistoryId: null };
  }
}

export function saveGeminiWorkspaceSnapshot(snapshot: GeminiWorkspaceSnapshot): void {
  if (!canUseSessionStorage()) return;
  try {
    const payload: GeminiWorkspaceSnapshot = {
      turns: snapshot.turns.filter((t) => !t.pending).slice(-MAX_TURNS),
      searchHistory: snapshot.searchHistory.slice(0, MAX_HISTORY),
      activeHistoryId: snapshot.activeHistoryId,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearGeminiWorkspaceSnapshot(): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
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
