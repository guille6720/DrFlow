import { describe, expect, it } from "vitest";

import {
  createOsLiquidationBatchSchema,
  osFeeScheduleSchema,
} from "@/core/validations/os-liquidacion-schemas";

import {
  buildOsLiquidationCsv,
  formatOsAmount,
  isOsLiquidationActionable,
  labelOsLiquidationStatus,
} from "@/features/facturacion/utils/os-liquidacion";

describe("osFeeScheduleSchema", () => {
  it("accepts valid fee schedule", () => {
    expect(
      osFeeScheduleSchema.safeParse({
        insurance_provider: "OSDE",
        amount: 15000,
      }).success
    ).toBe(true);
  });

  it("rejects negative amount", () => {
    expect(
      osFeeScheduleSchema.safeParse({
        insurance_provider: "OSDE",
        amount: -1,
      }).success
    ).toBe(false);
  });
});

describe("createOsLiquidationBatchSchema", () => {
  it("requires period_to after period_from", () => {
    expect(
      createOsLiquidationBatchSchema.safeParse({
        insurance_provider: "IOMA",
        period_from: "2026-08-10",
        period_to: "2026-08-01",
      }).success
    ).toBe(false);
  });
});

describe("os liquidacion utils", () => {
  it("formats ARS amounts", () => {
    expect(formatOsAmount(1234.5)).toContain("1.234");
  });

  it("labels liquidation status", () => {
    expect(labelOsLiquidationStatus("submitted")).toBe("Presentado");
  });

  it("detects actionable batch statuses", () => {
    expect(isOsLiquidationActionable("draft")).toBe(true);
    expect(isOsLiquidationActionable("paid")).toBe(false);
  });

  it("builds CSV with net column", () => {
    const csv = buildOsLiquidationCsv([
      {
        id: "1",
        appointment_id: null,
        patient_id: "p1",
        professional_id: null,
        insurance_provider: "OSDE",
        insurance_number: "123",
        insurance_plan: "210",
        practice_code: "420101",
        practice_label: "Consulta médica",
        amount: 1000,
        copago_collected: 200,
        status: "in_batch",
        attended_at: "2026-08-10T15:00:00.000Z",
        patient_name: "Pérez, Juan",
        professional_name: "Dr. López",
      },
    ]);
    expect(csv).toContain("fecha_atencion");
    expect(csv).toContain("800.00");
    expect(csv).toContain("Pérez, Juan");
  });
});
