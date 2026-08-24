import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";

import { COMMAND_PALETTE_ACTIONS, COMMAND_PALETTE_NAV } from "@/lib/constants/command-palette-items";
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

  it("hides caja when the commercial catalog denies it", () => {
    const result = filterCommandPaletteItems(
      COMMAND_PALETTE_NAV,
      "caja",
      "clinic_admin",
      false,
      undefined,
      {
        catalogAvailable: true,
        planKey: "basic",
        status: "active",
        allowed: { [FEATURES.CASH_REGISTER]: false },
        usage: {},
        limits: {},
      }
    );
    expect(result.some((item) => item.href === "/caja")).toBe(false);
  });
});

describe("mapPatientHits", () => {
  it("builds patient command rows with workflow deep links", () => {
    const hits = mapPatientHits([
      { id: "1", first_name: "Ana", last_name: "García", document_number: "12345678" },
    ]);
    expect(hits[0]?.label).toBe("García, Ana");
    expect(hits[0]?.href).toBe("/pacientes/1");
    expect(hits[0]?.soapHref).toContain("/pacientes/1");
    expect(hits[0]?.soapHref).toContain("action=nueva");
    expect(hits[0]?.rxHref).toContain("tab=recetas");
  });
});

describe("isEditableTarget", () => {
  it("detects input elements", () => {
    const input = document.createElement("input");
    expect(isEditableTarget(input)).toBe(true);
  });
});
