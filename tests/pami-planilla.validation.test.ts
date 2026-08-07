import { describe, expect, it } from "vitest";

import {
  clampPamiPlanillaFieldValue,
  clampPamiPlanillaValues,
  PAMI_PLANILLA_FIELD_MULTILINE_MAX,
  PAMI_PLANILLA_FIELD_SINGLE_MAX,
  PAMI_PLANILLA_RENDERED_MAX,
  parsePamiPlanillaValues,
  validatePamiPlanillaForExport,
  validatePamiPlanillaHasUserContent,
  validatePamiPlanillaRendered,
} from "@/core/validations/pami-planilla";

import {
  PAMI_PLANILLA_TEMPLATES,
  renderPamiPlanilla,
} from "@/lib/constants/pami-planillas";

const ID_INICIAL = PAMI_PLANILLA_TEMPLATES.find((t) => t.id === "id-inicial")!;

const BASE_CTX = {
  patientName: "García, Juan",
  patientDni: "12345678",
  patientPami: "987654321",
  professionalName: "Dr. Pérez",
  licenseNumber: "12345",
};

describe("pami-planilla validation — ejemplos válidos", () => {
  it.each([
    ["motivo clínico", { motivo: "EPOC descompensado", diagnostico: "J44.1" }],
    ["unicode español", { motivo: "Control — niño/a con fiebre", diagnostico: "J06.9" }],
    ["emoji permitido", { motivo: "Seguimiento 🩺 domiciliario", plan: "O2 + ATB" }],
    ["comparación con <", { motivo: "PA sistólica < 140 mmHg", diagnostico: "I10" }],
    ["multilínea", { plan: "Oxigenoterapia\nAntibiótico EV\nControles diarios" }],
  ])("acepta %s", (_label, partial) => {
    const values = {
      motivo: "",
      diagnostico: "",
      cuidador: "",
      domicilio: "",
      plan: "",
      ...partial,
    };
    const parsed = parsePamiPlanillaValues(ID_INICIAL, values);
    expect(parsed.ok).toBe(true);

    const rendered = renderPamiPlanilla(ID_INICIAL, values, BASE_CTX);
    expect(validatePamiPlanillaRendered(rendered)).toBeNull();
    expect(validatePamiPlanillaForExport(ID_INICIAL, values, rendered).ok).toBe(true);
  });
});

describe("pami-planilla validation — pruebas negativas", () => {
  it.each([
    ["HTML en motivo", { motivo: "<script>alert(1)</script>" }, "HTML"],
    ["JavaScript URI", { plan: "ver javascript:alert(1)" }, "JavaScript"],
    ["null byte", { motivo: "EPOC\u0000" }, "no permitidos"],
    ["unicode invisible", { diagnostico: "J44.1\u200B" }, "Unicode invisibles"],
    ["solo espacios", { motivo: "   \t  " }, "Completá al menos un campo"],
  ])("rechaza %s", (_label, partial, fragment) => {
    const values = {
      motivo: "EPOC",
      diagnostico: "J44.1",
      cuidador: "",
      domicilio: "",
      plan: "",
      ...partial,
    };

    if (fragment === "Completá al menos un campo") {
      const onlySpaces = { motivo: "   ", diagnostico: "", cuidador: "", domicilio: "", plan: "" };
      expect(validatePamiPlanillaHasUserContent(ID_INICIAL, onlySpaces)).toContain(fragment);
      return;
    }

    const parsed = parsePamiPlanillaValues(ID_INICIAL, values);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(fragment);
  });

  it("rechaza campo single-line demasiado largo", () => {
    const values = {
      motivo: "EPOC",
      diagnostico: "x".repeat(PAMI_PLANILLA_FIELD_SINGLE_MAX + 1),
      cuidador: "",
      domicilio: "",
      plan: "",
    };
    const parsed = parsePamiPlanillaValues(ID_INICIAL, values);
    expect(parsed.ok).toBe(false);
  });

  it("rechaza campo multilínea demasiado largo", () => {
    const values = {
      motivo: "x".repeat(PAMI_PLANILLA_FIELD_MULTILINE_MAX + 1),
      diagnostico: "",
      cuidador: "",
      domicilio: "",
      plan: "",
    };
    const parsed = parsePamiPlanillaValues(ID_INICIAL, values);
    expect(parsed.ok).toBe(false);
  });

  it("rechaza documento renderizado extremadamente largo", () => {
    const rendered = "x".repeat(PAMI_PLANILLA_RENDERED_MAX + 1);
    expect(validatePamiPlanillaRendered(rendered)).toContain("superar");
  });

  it("rechaza payload JSON excesivo", () => {
    const values = {
      motivo: "a".repeat(PAMI_PLANILLA_FIELD_MULTILINE_MAX),
      diagnostico: "a".repeat(PAMI_PLANILLA_FIELD_SINGLE_MAX),
      cuidador: "a".repeat(PAMI_PLANILLA_FIELD_SINGLE_MAX),
      domicilio: "a".repeat(PAMI_PLANILLA_FIELD_MULTILINE_MAX),
      plan: "a".repeat(PAMI_PLANILLA_FIELD_MULTILINE_MAX),
    };
    const parsed = parsePamiPlanillaValues(ID_INICIAL, values);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("demasiado grandes");
  });

  it("rechaza export sin contenido de usuario", () => {
    const values = { motivo: "", diagnostico: "", cuidador: "", domicilio: "", plan: "" };
    const rendered = renderPamiPlanilla(ID_INICIAL, values, BASE_CTX);
    const result = validatePamiPlanillaForExport(ID_INICIAL, values, rendered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("al menos un campo");
  });
});

describe("pami-planilla validation — casos borde", () => {
  it("clamp recorta entrada al máximo del campo", () => {
    expect(clampPamiPlanillaFieldValue("x".repeat(600), false).length).toBe(
      PAMI_PLANILLA_FIELD_SINGLE_MAX
    );
    expect(clampPamiPlanillaFieldValue("x".repeat(3000), true).length).toBe(
      PAMI_PLANILLA_FIELD_MULTILINE_MAX
    );
  });

  it("clampPamiPlanillaValues solo afecta claves de la plantilla", () => {
    const clamped = clampPamiPlanillaValues(ID_INICIAL, {
      motivo: "x".repeat(3000),
      extra: "ignored-but-kept",
    });
    expect(clamped.motivo!.length).toBe(PAMI_PLANILLA_FIELD_MULTILINE_MAX);
    expect(clamped.extra).toBe("ignored-but-kept");
  });

  it("acepta exactamente el máximo de campo single-line", () => {
    const values = {
      motivo: "EPOC",
      diagnostico: "x".repeat(PAMI_PLANILLA_FIELD_SINGLE_MAX),
      cuidador: "",
      domicilio: "",
      plan: "",
    };
    expect(parsePamiPlanillaValues(ID_INICIAL, values).ok).toBe(true);
  });

  it("ignora claves desconocidas al validar", () => {
    const values = {
      motivo: "EPOC descompensado",
      diagnostico: "J44.1",
      cuidador: "",
      domicilio: "",
      plan: "",
      injected: "<script>x</script>",
    };
    const parsed = parsePamiPlanillaValues(ID_INICIAL, values);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.injected).toBeUndefined();
  });
});
