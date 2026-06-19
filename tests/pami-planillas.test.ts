import { describe, expect, it } from "vitest";
import {
  PAMI_PLANILLA_TEMPLATES,
  renderPamiPlanilla,
} from "@/lib/constants/pami-planillas";

describe("PAMI planillas", () => {
  it("renderiza plantilla con datos del paciente", () => {
    const tpl = PAMI_PLANILLA_TEMPLATES.find((t) => t.id === "id-inicial")!;
    const text = renderPamiPlanilla(
      tpl,
      { motivo: "EPOC descompensado", diagnostico: "J44.1", cuidador: "Hijo", domicilio: "Calle 123", plan: "O2 + ATB" },
      {
        patientName: "García, Juan",
        patientDni: "12345678",
        patientPami: "987654321",
        professionalName: "Dr. Pérez",
        licenseNumber: "12345",
      }
    );
    expect(text).toContain("García, Juan");
    expect(text).toContain("12345678");
    expect(text).toContain("987654321");
    expect(text).toContain("EPOC descompensado");
    expect(text).toContain("Dr. Pérez");
  });

  it("tiene plantillas para internación, insumos y geriátrico", () => {
    const categories = new Set(PAMI_PLANILLA_TEMPLATES.map((t) => t.category));
    expect(categories.has("internacion_domiciliaria")).toBe(true);
    expect(categories.has("geriatrico")).toBe(true);
    expect(categories.has("insumos")).toBe(true);
  });
});
