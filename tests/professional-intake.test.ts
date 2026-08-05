import { describe, expect, it } from "vitest";

import {
  AGENDA_PRESETS,
  PROFESSIONAL_INTAKE_SECTIONS,
  WEEKDAY_LABELS,
} from "@/lib/constants/professional-intake-checklist";

describe("professional intake checklist", () => {
  it("includes core Argentine intake sections", () => {
    const ids = PROFESSIONAL_INTAKE_SECTIONS.map((s) => s.id);
    expect(ids).toContain("identidad");
    expect(ids).toContain("matricula");
    expect(ids).toContain("consultorio");
    expect(ids).toContain("agenda");
  });

  it("provides agenda presets for weekdays", () => {
    expect(AGENDA_PRESETS[0].rules.length).toBe(5);
    expect(WEEKDAY_LABELS[1]).toBe("Lunes");
  });
});
