import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { buildPrioritizedDiagnosisHits } from "@/features/historias/utils/prioritize-clinical-search";

describe("115_clinical_recent_usage migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/115_clinical_recent_usage.sql"),
    "utf8"
  );

  it("stores recent clinical terms per user without patient linkage", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.clinical_recent_usage/);
    expect(sql).toMatch(/user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/record_clinical_recent_usage/);
    expect(sql).toMatch(/SENSITIVE_PAYLOAD_FORBIDDEN/);
    expect(sql).toMatch(/patient_id/);
    expect(sql).not.toMatch(/REFERENCES patients/);
    expect(sql).not.toMatch(/clinical_record_id UUID REFERENCES/);
  });
});

describe("buildPrioritizedDiagnosisHits", () => {
  it("orders favorites, then recent, separator, then catalog", () => {
    const hits = buildPrioritizedDiagnosisHits({
      favorites: [
        {
          id: "f1",
          user_id: "u1",
          kind: "diagnosis",
          fingerprint: "name:hipertension arterial|cie:i10",
          label: "Hipertensión arterial",
          payload: { name: "Hipertensión arterial", cie10_code: "I10" },
          sort_order: 0,
          created_at: "",
          updated_at: "",
        },
      ],
      recent: [
        {
          id: "r1",
          user_id: "u1",
          kind: "diagnosis",
          fingerprint: "name:hipotiroidismo|cie:",
          label: "Hipotiroidismo",
          payload: { name: "Hipotiroidismo" },
          last_used_at: "",
          use_count: 2,
          created_at: "",
        },
      ],
      catalog: [
        {
          id: "c1",
          name: "Hipertensión secundaria",
          cie10_code: "I15",
        },
        {
          id: "c2",
          name: "Hipertensión arterial",
          cie10_code: "I10",
        },
      ],
    });

    expect(hits.map((h) => h.source)).toEqual([
      "favorite",
      "recent",
      "separator",
      "catalog",
    ]);
    expect(hits[0]?.source === "favorite" && hits[0].payload.name).toBe("Hipertensión arterial");
    expect(hits[1]?.source === "recent" && hits[1].payload.name).toBe("Hipotiroidismo");
    expect(hits[3]?.source === "catalog" && hits[3].payload.name).toBe(
      "Hipertensión secundaria"
    );
  });
});
