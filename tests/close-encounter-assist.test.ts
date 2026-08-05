import { describe, expect, it } from "vitest";

import {
  buildCloseEncounterBundleText,
  buildCloseEncounterSteps,
} from "@/lib/utils/close-encounter-assist";

describe("close-encounter-assist", () => {
  it("buildCloseEncounterSteps includes evolution and patient instructions", () => {
    const steps = buildCloseEncounterSteps({
      patientName: "Pérez, Juan",
      lastEvolution: "Control DM2 estable.",
      lastDiagnosis: "Diabetes mellitus tipo 2",
      diagnosis: "DM2",
      evolutionText: "Control DM2 estable.",
    });
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("evolution_summary");
    expect(ids).toContain("patient_instructions");
    expect(steps.find((s) => s.id === "evolution_summary")?.item).not.toBeNull();
  });

  it("buildCloseEncounterSteps adds order draft for diabetes context", () => {
    const steps = buildCloseEncounterSteps({
      orderIntentText: "control diabetes",
      lastDiagnosis: "DM2",
    });
    const order = steps.find((s) => s.id === "order");
    expect(order?.item?.body).toContain("HbA1c");
  });

  it("buildCloseEncounterSteps uses discharge summary when available", () => {
    const steps = buildCloseEncounterSteps({
      lastEvolution: "Alta médica programada.",
      lastDiagnosis: "Neumonía",
      evolutionText: "Alta médica programada.",
    });
    const evolution = steps.find((s) => s.id === "evolution_summary")?.item;
    expect(evolution?.kind).toBe("evolution_summary");
    expect(evolution?.body.length).toBeGreaterThan(10);
  });

  it("buildCloseEncounterSteps includes certificate when context allows", () => {
    const steps = buildCloseEncounterSteps({
      lastDiagnosis: "Gripe",
      chiefComplaint: "Fiebre",
    });
    expect(steps.find((s) => s.id === "certificate")).toBeDefined();
  });

  it("buildCloseEncounterSteps fallback follow-up when no reminders", () => {
    const steps = buildCloseEncounterSteps({});
    const followUp = steps.find((s) => s.id === "follow_up")?.item;
    expect(followUp?.body).toContain("Control según criterio clínico");
  });

  it("buildCloseEncounterBundleText joins available steps", () => {
    const steps = buildCloseEncounterSteps({
      lastEvolution: "Evolución de prueba.",
      lastDiagnosis: "HTA",
    });
    const bundle = buildCloseEncounterBundleText(steps);
    expect(bundle).toContain("=== Evolución ===");
    expect(bundle.length).toBeGreaterThan(20);
  });
});
