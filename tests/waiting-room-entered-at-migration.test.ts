import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/108_waiting_room_entered_at.sql"),
  "utf8"
);

describe("108_waiting_room_entered_at migration", () => {
  it("adds waiting_room_entered_at and stamps it on check-in", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS waiting_room_entered_at/);
    expect(sql).toMatch(/waiting_room_entered_at = v_entered_at/);
    expect(sql).toMatch(/v_in_queue := p_waiting_room_status IN \('waiting', 'confirmed'\)/);
  });
});
