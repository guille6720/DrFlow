import { describe, expect, it } from "vitest";
import { buildStaticPaletteSections } from "@/lib/utils/command-palette-layout";
import { resolveConsultationPathologyQuery } from "@/lib/utils/consultation-pathology-query";

describe("buildStaticPaletteSections", () => {
  it("assigns contiguous indices across action and nav groups", () => {
    const actions = [
      { id: "a1", label: "A1", href: "/a1", group: "acciones" as const, icon: () => null },
    ];
    const nav = [
      { id: "n1", label: "N1", href: "/n1", group: "navegacion" as const, icon: () => null },
      { id: "n2", label: "N2", href: "/n2", group: "navegacion" as const, icon: () => null },
    ];
    const { sections, patientStartIndex } = buildStaticPaletteSections(actions, nav);
    expect(sections).toHaveLength(2);
    expect(sections[0]?.rows[0]?.index).toBe(0);
    expect(sections[1]?.rows[0]?.index).toBe(1);
    expect(sections[1]?.rows[1]?.index).toBe(2);
    expect(patientStartIndex).toBe(3);
  });
});

describe("resolveConsultationPathologyQuery", () => {
  it("prefers diagnosis extracted from evolution text", () => {
    const query = resolveConsultationPathologyQuery("Dx: Hipertensión arterial esencial");
    expect(query.toLowerCase()).toContain("hipertens");
  });
});
