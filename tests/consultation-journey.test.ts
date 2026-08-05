import { describe, expect, it } from "vitest";

import {
  canNavigateToJourneyStep,
  CONSULTATION_JOURNEY_STEPS,
  getConsultationJourneySteps,
  journeyProgressPercent,
  nextJourneyStepId,
} from "@/lib/utils/consultation-journey";

describe("consultation-journey", () => {
  it("returns full steps when physician can issue", () => {
    expect(getConsultationJourneySteps(true)).toEqual(CONSULTATION_JOURNEY_STEPS);
  });

  it("omits rx and order when physician cannot issue", () => {
    const steps = getConsultationJourneySteps(false);
    expect(steps.map((s) => s.id)).toEqual(["evolution", "follow_up", "finish"]);
  });

  it("advances through the journey in order", () => {
    const steps = getConsultationJourneySteps(true);
    expect(nextJourneyStepId(steps, "evolution")).toBe("prescription");
    expect(nextJourneyStepId(steps, "prescription")).toBe("order");
    expect(nextJourneyStepId(steps, "order")).toBe("follow_up");
    expect(nextJourneyStepId(steps, "follow_up")).toBe("finish");
    expect(nextJourneyStepId(steps, "finish")).toBeNull();
  });

  it("calculates progress from current step", () => {
    const steps = getConsultationJourneySteps(true);
    expect(journeyProgressPercent(steps, "evolution")).toBe(20);
    expect(journeyProgressPercent(steps, "finish")).toBe(100);
  });

  it("allows navigating back to completed steps", () => {
    const steps = getConsultationJourneySteps(true);
    const status = { evolution: "completed" as const, prescription: "completed" as const };
    expect(canNavigateToJourneyStep(steps, "evolution", "order", status)).toBe(true);
    expect(canNavigateToJourneyStep(steps, "prescription", "order", status)).toBe(true);
  });

  it("blocks forward navigation until prior steps are done", () => {
    const steps = getConsultationJourneySteps(true);
    expect(canNavigateToJourneyStep(steps, "order", "evolution", { evolution: "completed" })).toBe(
      false
    );
    expect(
      canNavigateToJourneyStep(steps, "order", "prescription", {
        evolution: "completed",
        prescription: "skipped",
      })
    ).toBe(true);
  });
});
