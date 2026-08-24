import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/017_demo_patients_and_consultations.sql"),
  "utf8"
);

describe("017_demo_patients_and_consultations migration", () => {
  it("only inserts clinical_records when created_by is non-null", () => {
    const clinicalInserts = sql.match(/INSERT INTO clinical_records[\s\S]*?;/g) ?? [];
    expect(clinicalInserts.length).toBe(2);

    for (const block of clinicalInserts) {
      expect(block).toMatch(/creator\.user_id IS NOT NULL/);
      expect(block).toMatch(/CROSS JOIN creator/);
      expect(block).not.toMatch(
        /COALESCE\(\s*\(SELECT cm\.user_id[\s\S]*?\(SELECT id FROM profiles LIMIT 1\)\s*\)\s*FROM patients/
      );
    }
  });
});
