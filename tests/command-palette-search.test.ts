import { describe, expect, it } from "vitest";
import { COMMAND_PALETTE_ACTIONS } from "@/lib/constants/command-palette-items";
import {
  filterCommandPaletteItems,
  isEditableTarget,
  mapPatientHits,
} from "@/lib/utils/command-palette-search";

describe("filterCommandPaletteItems", () => {
  it("returns permitted actions for doctor role", () => {
    const result = filterCommandPaletteItems(COMMAND_PALETTE_ACTIONS, "", "doctor", false);
    expect(result.some((i) => i.id === "action-new-consultation")).toBe(true);
  });

  it("filters by query keywords", () => {
    const result = filterCommandPaletteItems(COMMAND_PALETTE_ACTIONS, "receta", "doctor", false);
    expect(result.some((i) => i.id === "action-new-prescription")).toBe(true);
    expect(result.some((i) => i.id === "action-new-patient")).toBe(false);
  });

  it("hides clinical actions from secretary", () => {
    const result = filterCommandPaletteItems(COMMAND_PALETTE_ACTIONS, "", "secretary", false);
    expect(result.some((i) => i.id === "action-new-consultation")).toBe(false);
    expect(result.some((i) => i.id === "action-new-appointment")).toBe(true);
  });
});

describe("mapPatientHits", () => {
  it("builds patient command rows", () => {
    const hits = mapPatientHits([
      { id: "1", first_name: "Ana", last_name: "García", document_number: "12345678" },
    ]);
    expect(hits[0]?.label).toBe("García, Ana");
    expect(hits[0]?.href).toBe("/pacientes/1");
  });
});

describe("isEditableTarget", () => {
  it("detects input elements", () => {
    const input = document.createElement("input");
    expect(isEditableTarget(input)).toBe(true);
  });
});
