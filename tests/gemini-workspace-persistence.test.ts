import { describe, expect, it } from "vitest";

import { upsertGeminiSearchHistory } from "@/features/ia/lib/gemini-workspace-persistence";

describe("upsertGeminiSearchHistory", () => {
  it("puts the newest query first and dedupes by text", () => {
    const first = upsertGeminiSearchHistory([], {
      query: "bronquiectasias",
      patientCount: 8,
      patients: [{ id: "1", name: "A", date: "2026-01-01", diagnosis: "Bronquiectasias" }],
    });
    const second = upsertGeminiSearchHistory(first, {
      query: "Bronquiectasias",
      patientCount: 8,
      patients: [{ id: "1", name: "A", date: "2026-01-01", diagnosis: "Bronquiectasias" }],
    });
    expect(second).toHaveLength(1);
    expect(second[0]?.query).toBe("Bronquiectasias");

    const third = upsertGeminiSearchHistory(second, {
      query: "pacientes con asma",
      patientCount: 2,
      patients: [],
    });
    expect(third).toHaveLength(2);
    expect(third[0]?.query).toBe("pacientes con asma");
  });
});
