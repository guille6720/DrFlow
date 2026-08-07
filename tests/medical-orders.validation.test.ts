import { describe, expect, it } from "vitest";

import {
  CLINICAL_TEXT_MAX,
  CLINICAL_TEXT_RAW_MAX,
  getClinicalTextValidationError,
  MEDICAL_ORDER_TEXT_MAX,
} from "@/core/validations/clinical-free-text";
import { medicalOrderFormSchema } from "@/core/validations/medical-order";
import { prescriptionDraftSchema } from "@/core/validations/schemas";

import {
  parseMedicalOrderForm,
  parseValidatedMedicalOrderInput,
  validateMedicalOrderInput,
} from "@/features/recetas/services/medical-orders.service";

const VALID_UUID_A = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_B = "550e8400-e29b-41d4-a716-446655440001";

function validMedicalOrderInput(overrides: Record<string, unknown> = {}) {
  return {
    patient_id: VALID_UUID_A,
    professional_id: VALID_UUID_B,
    order_text: "RMN cerebral con contraste",
    notes: null,
    clinical_record_id: null,
    order_type: "study" as const,
    ...overrides,
  };
}

describe("clinical-free-text", () => {
  describe("ejemplos válidos", () => {
    it.each([
      ["texto clínico simple", "Hemograma completo"],
      ["unicode español", "Ecografía hepática — control postoperatorio (año 2025)"],
      ["emoji permitido", "Control 🩺 en 30 días"],
      ["comparación numérica con <", "PA sistólica < 140 mmHg"],
      ["multilínea", "Laboratorio:\n- Glucemia\n- Urea"],
      ["máximo permitido", "a".repeat(MEDICAL_ORDER_TEXT_MAX)],
    ])("acepta %s", (_label, value) => {
      expect(
        getClinicalTextValidationError(value, {
          fieldLabel: "La orden",
          maxLength: MEDICAL_ORDER_TEXT_MAX,
          required: true,
        })
      ).toBeNull();
    });
  });

  describe("pruebas negativas", () => {
    it.each([
      ["cadena vacía", "", "La orden: campo obligatorio."],
      ["solo espacios", "   \t\n  ", "La orden: no puede contener solo espacios."],
      ["HTML script", '<script>alert("xss")</script>', "La orden no puede contener HTML."],
      ["HTML tag", "<b>urgente</b>", "La orden no puede contener HTML."],
      ["javascript URI", "javascript:alert(1)", "La orden no puede contener JavaScript"],
      ["event handler", '<img src=x onerror=alert(1)>', "La orden no puede contener HTML."],
      ["data URI html", "data:text/html,<h1>x</h1>", "La orden no puede contener HTML"],
      ["null byte", "hemograma\u0000completo", "La orden contiene caracteres no permitidos."],
      ["control char", "hemograma\u0007", "La orden contiene caracteres de control"],
      ["unicode invisible", "hemograma\u200Bcompleto", "La orden contiene caracteres Unicode invisibles"],
      ["payload extremo", "x".repeat(CLINICAL_TEXT_RAW_MAX + 1), "La orden es demasiado largo"],
      ["supera max lógico", "x".repeat(MEDICAL_ORDER_TEXT_MAX + 1), "La orden no puede superar"],
    ])("rechaza %s", (_label, value, expectedFragment) => {
      const error = getClinicalTextValidationError(value, {
        fieldLabel: "La orden",
        maxLength: MEDICAL_ORDER_TEXT_MAX,
        required: true,
      });
      expect(error).toBeTruthy();
      expect(error).toContain(expectedFragment.split(".")[0]!);
    });
  });

  describe("casos borde", () => {
    it("permite notas vacías opcionales", () => {
      expect(
        getClinicalTextValidationError("", {
          fieldLabel: "Las notas",
          maxLength: CLINICAL_TEXT_MAX,
          required: false,
        })
      ).toBeNull();
    });

    it("acepta exactamente MEDICAL_ORDER_TEXT_MAX caracteres tras trim", () => {
      expect(
        getClinicalTextValidationError("a".repeat(MEDICAL_ORDER_TEXT_MAX), {
          fieldLabel: "La orden",
          maxLength: MEDICAL_ORDER_TEXT_MAX,
          required: true,
        })
      ).toBeNull();
    });

    it("rechaza crudo entre max lógico y raw max por tamaño lógico", () => {
      const value = "a".repeat(MEDICAL_ORDER_TEXT_MAX + 1);
      expect(value.length).toBeLessThanOrEqual(CLINICAL_TEXT_RAW_MAX);
      expect(
        getClinicalTextValidationError(value, {
          fieldLabel: "La orden",
          maxLength: MEDICAL_ORDER_TEXT_MAX,
          required: true,
        })
      ).toContain("no puede superar");
    });
  });
});

describe("medicalOrderFormSchema", () => {
  it("acepta orden clínica válida completa", () => {
    const result = medicalOrderFormSchema.safeParse(validMedicalOrderInput());
    expect(result.success).toBe(true);
  });

  it("rechaza order_type desconocido", () => {
    const result = medicalOrderFormSchema.safeParse(
      validMedicalOrderInput({ order_type: "invalid" })
    );
    expect(result.success).toBe(false);
  });

  it("normaliza clinical_record_id vacío a null", () => {
    const result = medicalOrderFormSchema.safeParse(
      validMedicalOrderInput({ clinical_record_id: "" })
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.clinical_record_id).toBeNull();
  });
});

describe("medical-orders validation pipeline", () => {
  it("parseMedicalOrderForm conserva texto crudo para validación", () => {
    const fd = new FormData();
    fd.set("patient_id", VALID_UUID_A);
    fd.set("professional_id", VALID_UUID_B);
    fd.set("order_text", "  RMN cerebral  ");
    fd.set("order_type", "study");

    const parsed = parseMedicalOrderForm(fd);
    expect(parsed.order_text).toBe("  RMN cerebral  ");
  });

  it("parseValidatedMedicalOrderInput sanitiza tras validar", () => {
    const fd = new FormData();
    fd.set("patient_id", VALID_UUID_A);
    fd.set("professional_id", VALID_UUID_B);
    fd.set("order_text", "  RMN cerebral  ");
    fd.set("order_type", "study");

    const result = parseValidatedMedicalOrderInput(parseMedicalOrderForm(fd));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.order_text).toBe("RMN cerebral");
  });

  it("rechaza HTML en order_text con mensaje claro", () => {
    const error = validateMedicalOrderInput(
      validMedicalOrderInput({ order_text: "<script>alert(1)</script>" })
    );
    expect(error).toContain("HTML");
  });

  it("rechaza payload extremadamente grande", () => {
    const error = validateMedicalOrderInput(
      validMedicalOrderInput({ order_text: "x".repeat(CLINICAL_TEXT_RAW_MAX + 500) })
    );
    expect(error).toContain("demasiado largo");
  });

  it("rechaza notas con javascript:", () => {
    const error = validateMedicalOrderInput(
      validMedicalOrderInput({ notes: "ver javascript:alert(1)" })
    );
    expect(error).toContain("JavaScript");
  });

  it("acepta unicode clínico y emoji en orden", () => {
    expect(
      validateMedicalOrderInput(
        validMedicalOrderInput({
          order_text: "Control — niño/a con fiebre 🌡️",
        })
      )
    ).toBeNull();
  });
});

describe("prescriptionDraftSchema hardening", () => {
  const basePrescription = {
    patient_id: VALID_UUID_A,
    professional_id: VALID_UUID_B,
    prescription_type: "ambulatoria" as const,
    diagnosis_cie10: "J06.9",
    diagnosis_text: "Infección respiratoria aguda",
    medications: [
      {
        generic_name: "Paracetamol",
        quantity: 1,
        posology: "500 mg cada 8 horas",
      },
    ],
    validity_days: 30,
    disclaimer_accepted: true as const,
  };

  it("acepta receta válida", () => {
    expect(prescriptionDraftSchema.safeParse(basePrescription).success).toBe(true);
  });

  it("rechaza diagnóstico con HTML", () => {
    const result = prescriptionDraftSchema.safeParse({
      ...basePrescription,
      diagnosis_text: "<b>infección</b>",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("HTML");
    }
  });

  it("rechaza posología vacía", () => {
    const result = prescriptionDraftSchema.safeParse({
      ...basePrescription,
      medications: [{ generic_name: "Ibuprofeno", quantity: 1, posology: "   " }],
    });
    expect(result.success).toBe(false);
  });

  it("rechaza nombre genérico con script", () => {
    const result = prescriptionDraftSchema.safeParse({
      ...basePrescription,
      medications: [
        {
          generic_name: "<script>x</script>",
          quantity: 1,
          posology: "1 comp/día",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
