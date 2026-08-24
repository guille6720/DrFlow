import { describe, expect, it } from "vitest";

import {
  relatedActionToTreatmentEntry,
  treatmentAlreadyIncludesAction,
} from "@/features/historias/clinical-suggestions/apply-related-action";
import { RELATED_ACTION_DEFINITIONS } from "@/features/historias/clinical-suggestions/registry";
import { resolveRelatedActionsForDiagnoses } from "@/features/historias/clinical-suggestions/resolve-related-actions";

describe("resolveRelatedActionsForDiagnoses", () => {
  it("returns empty when there are no diagnoses", () => {
    expect(resolveRelatedActionsForDiagnoses([])).toEqual([]);
  });

  it("suggests HTA-related quick actions without selecting them", () => {
    const actions = resolveRelatedActionsForDiagnoses([
      { name: "Hipertensión arterial", cie10_code: "I10" },
    ]);
    const labels = actions.map((a) => a.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Control de PA",
        "Solicitar laboratorio",
        "ECG",
        "MAPA",
        "Interconsulta",
      ])
    );
    expect(actions.every((a) => !a.applyAs.product.toLowerCase().includes("mg"))).toBe(true);
  });

  it("deduplicates actions across multiple matching diagnoses", () => {
    const actions = resolveRelatedActionsForDiagnoses([
      { name: "Hipertensión arterial", cie10_code: "I10" },
      { name: "Diabetes mellitus tipo 2", cie10_code: "E11" },
    ]);
    const labs = actions.filter((a) => a.id === "solicitar_laboratorio");
    expect(labs).toHaveLength(1);
    expect(labs[0].fromDiagnosisNames).toEqual(
      expect.arrayContaining(["Hipertensión arterial", "Diabetes mellitus tipo 2"])
    );
  });

  it("does not invent suggestions for unknown diagnoses", () => {
    expect(
      resolveRelatedActionsForDiagnoses([{ name: "Consulta de control sin patología específica" }])
    ).toEqual([]);
  });
});

describe("relatedActionToTreatmentEntry", () => {
  it("maps confirmed action to conduct without dose or frequency", () => {
    const entry = relatedActionToTreatmentEntry(RELATED_ACTION_DEFINITIONS.control_pa);
    expect(entry.product).toBe("Control de PA");
    expect(entry.kind).toBe("conduct");
    expect(entry.dose).toBeUndefined();
    expect(entry.frequency).toBeUndefined();
    expect(entry.catalog_source).toBe("diagnosis_related_suggestion");
  });

  it("detects already confirmed actions", () => {
    const action = RELATED_ACTION_DEFINITIONS.ecg;
    expect(
      treatmentAlreadyIncludesAction([{ product: "ECG", kind: "conduct" }], action)
    ).toBe(true);
    expect(treatmentAlreadyIncludesAction([{ product: "MAPA" }], action)).toBe(false);
  });
});
