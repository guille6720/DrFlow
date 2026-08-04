import { describe, expect, it } from "vitest";
import {
  buildCoverageNoteItem,
  buildDosageHintItems,
  buildFollowUpReminderItems,
  buildOrderDraftSuggestion,
  getMatchedOrderPanelLabels,
  isPamiCoverage,
} from "@/lib/utils/medication-order-assist";

describe("medication-order-assist", () => {
  it("buildOrderDraftSuggestion expands diabetes control panel", () => {
    const item = buildOrderDraftSuggestion({
      orderIntentText: "Control de diabetes anual",
    });
    expect(item?.body).toContain("HbA1c");
    expect(item?.body).toContain("Microalbuminuria");
    expect(item?.body).toContain("Fondo de ojo");
  });

  it("getMatchedOrderPanelLabels detects diabetes panel", () => {
    const labels = getMatchedOrderPanelLabels({ orderIntentText: "control de diabetes" });
    expect(labels.some((l) => l.includes("diabetes"))).toBe(true);
  });

  it("buildDosageHintItems suggests metformina dose", () => {
    const items = buildDosageHintItems({
      proposedMedications: ["Metformina 850"],
    });
    expect(items.some((i) => i.body.toLowerCase().includes("metformina"))).toBe(true);
  });

  it("buildCoverageNoteItem flags PAMI patient", () => {
    expect(isPamiCoverage({ insurance: "PAMI" })).toBe(true);
    const item = buildCoverageNoteItem({
      insurance: "PAMI",
      insurancePlan: "12345678",
    });
    expect(item?.body).toContain("PAMI");
    expect(item?.body).toContain("vademécum");
  });

  it("buildFollowUpReminderItems includes diabetes follow-up", () => {
    const items = buildFollowUpReminderItems({
      orderIntentText: "control diabetes",
      lastDiagnosis: "DM2",
    });
    expect(items.length).toBeGreaterThan(0);
  });
});
