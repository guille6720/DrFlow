import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/106_vademecum_fuzzy_search.sql"),
  "utf8"
);

describe("106_vademecum_fuzzy_search migration", () => {
  it("extends search_pami_vademecum with trigram fuzzy matching", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION search_pami_vademecum/);
    expect(sql).toMatch(/similarity\(lower\(v\.active_ingredient\), t\.q\)/);
    expect(sql).toMatch(/word_similarity\(t\.q, lower\(v\.active_ingredient\)\)/);
  });
});
