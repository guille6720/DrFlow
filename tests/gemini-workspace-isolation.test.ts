import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearGeminiWorkspaceSnapshot,
  geminiWorkspaceStorageKey,
  loadGeminiWorkspaceSnapshot,
  saveGeminiWorkspaceSnapshot,
} from "@/features/ia/lib/gemini-workspace-persistence";

describe("gemini workspace sessionStorage isolation", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("namespaces storage keys by clinic_id + patient_id", () => {
    expect(
      geminiWorkspaceStorageKey({ clinicId: "clinic-a", patientId: "patient-a" })
    ).toBe("drflow:gemini-workspace:v1:clinic-a:patient-a");
    expect(
      geminiWorkspaceStorageKey({ clinicId: "clinic-a", patientId: "patient-b" })
    ).not.toBe(geminiWorkspaceStorageKey({ clinicId: "clinic-a", patientId: "patient-a" }));
  });

  it("does not leak chat turns from patient A into patient B", () => {
    saveGeminiWorkspaceSnapshot(
      {
        turns: [{ role: "assistant", text: "contexto-paciente-a" }],
        searchHistory: [],
        activeHistoryId: null,
      },
      { clinicId: "clinic-a", patientId: "patient-a" }
    );

    const forB = loadGeminiWorkspaceSnapshot({
      clinicId: "clinic-a",
      patientId: "patient-b",
    });
    expect(forB.turns).toEqual([]);

    const forA = loadGeminiWorkspaceSnapshot({
      clinicId: "clinic-a",
      patientId: "patient-a",
    });
    expect(forA.turns).toHaveLength(1);
    expect(forA.turns[0]?.text).toBe("contexto-paciente-a");
  });

  it("does not read unscoped legacy global turns when clinic is unknown", () => {
    sessionStorage.setItem(
      "drflow:gemini-workspace:v1",
      JSON.stringify({
        turns: [{ role: "assistant", text: "legacy-leak" }],
        searchHistory: [],
        activeHistoryId: null,
      })
    );
    expect(loadGeminiWorkspaceSnapshot(null).turns).toEqual([]);
  });

  it("clearing one patient scope leaves the other intact", () => {
    saveGeminiWorkspaceSnapshot(
      {
        turns: [{ role: "user", text: "a" }],
        searchHistory: [],
        activeHistoryId: null,
      },
      { clinicId: "clinic-a", patientId: "patient-a" }
    );
    saveGeminiWorkspaceSnapshot(
      {
        turns: [{ role: "user", text: "b" }],
        searchHistory: [],
        activeHistoryId: null,
      },
      { clinicId: "clinic-a", patientId: "patient-b" }
    );

    clearGeminiWorkspaceSnapshot({ clinicId: "clinic-a", patientId: "patient-a" });
    expect(
      loadGeminiWorkspaceSnapshot({ clinicId: "clinic-a", patientId: "patient-a" }).turns
    ).toEqual([]);
    expect(
      loadGeminiWorkspaceSnapshot({ clinicId: "clinic-a", patientId: "patient-b" }).turns[0]?.text
    ).toBe("b");
  });
});
