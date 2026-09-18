import { describe, expect, it } from "vitest";

import { APPOINTMENT_AGENDA_COLUMNS } from "@/core/supabase/select-columns";

describe("appointment agenda columns", () => {
  it("keeps core schedule fields required for loading turnos", () => {
    for (const column of [
      "id",
      "clinic_id",
      "patient_id",
      "professional_id",
      "start_at",
      "end_at",
      "status",
    ]) {
      expect(APPOINTMENT_AGENDA_COLUMNS.split(",").map((part) => part.trim())).toContain(column);
    }
  });
});
