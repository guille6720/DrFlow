import { describe, expect, it } from "vitest";

import { defaultFeatureMap } from "@/core/customizations/resolve";

import { buildCommandPaletteStaticItems } from "@/lib/utils/command-palette-static-items";

const RCTA_OFF = { enabled: false, href: "https://rcta.example/recetas" };
const RCTA_ON = { enabled: true, href: "https://rcta.example/recetas" };

function build(overrides: Partial<Parameters<typeof buildCommandPaletteStaticItems>[0]> = {}) {
  return buildCommandPaletteStaticItems({
    activePatientId: null,
    query: "",
    role: "doctor",
    isSuperadmin: false,
    customizationFeatures: defaultFeatureMap(),
    rcta: RCTA_OFF,
    ...overrides,
  });
}

describe("buildCommandPaletteStaticItems", () => {
  it("lists global actions before navigation when no patient is active", () => {
    const items = build();
    expect(items.some((i) => i.id.startsWith("ctx-"))).toBe(false);
    const firstNav = items.findIndex((i) => i.group === "navegacion");
    const lastAction = items.map((i) => i.group).lastIndexOf("acciones");
    expect(firstNav).toBeGreaterThan(lastAction);
  });

  it("prepends patient-context actions when a patient is active", () => {
    const items = build({ activePatientId: "p1" });
    expect(items[0]?.id.startsWith("ctx-")).toBe(true);
    expect(items.find((i) => i.id === "ctx-rx")?.href).toContain("/pacientes/p1");
  });

  it("applies the query filter to every group", () => {
    const items = build({ query: "receta", activePatientId: "p1" });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => /receta/i.test(`${i.label} ${i.description ?? ""} ${(i.keywords ?? []).join(" ")}`))).toBe(true);
  });

  it("hides items whose clinic customization feature is disabled", () => {
    const enabled = build({ role: "clinic_admin", query: "sala" });
    expect(enabled.some((i) => i.href === "/sala-espera")).toBe(true);

    const features = defaultFeatureMap();
    features.waiting_room = { ...features.waiting_room, enabled: false };
    const disabled = build({ role: "clinic_admin", query: "sala", customizationFeatures: features });
    expect(disabled.some((i) => i.href === "/sala-espera")).toBe(false);
  });

  it("routes prescription items to RCTA only when the integration is enabled", () => {
    const off = build({ activePatientId: "p1" });
    expect(off.find((i) => i.id === "action-new-prescription")?.href).toBe("/recetas");

    const on = build({ activePatientId: "p1", rcta: RCTA_ON });
    expect(on.find((i) => i.id === "action-new-prescription")?.href).toBe(RCTA_ON.href);
    expect(on.find((i) => i.id === "ctx-rx")?.href).toBe(RCTA_ON.href);
    expect(on.find((i) => i.id === "action-new-consultation")?.href).not.toBe(RCTA_ON.href);
  });

  it("returns nothing for a role without permissions on a non-matching query", () => {
    expect(build({ role: null, query: "zzzz-no-match" })).toEqual([]);
  });
});
