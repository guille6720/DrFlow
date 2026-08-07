import { describe, expect, it } from "vitest";

import {
  extractMissingColumnKey,
  extractUndefinedFunctionName,
  getRpcCode,
  isUniqueViolation,
  parsePostgresError,
  resolvePostgresUserMessage,
} from "@/core/errors/postgres-error";

describe("parsePostgresError", () => {
  it("reads RPC code from DETAIL (structured raise_app_error)", () => {
    const parsed = parsePostgresError({
      code: "P0001",
      message: "El profesional ya tiene un turno en ese horario",
      details: "APPOINTMENT_SLOT_CONFLICT",
    });
    expect(parsed.rpcCode).toBe("APPOINTMENT_SLOT_CONFLICT");
  });

  it("reads legacy RPC code when message equals the code", () => {
    expect(getRpcCode({ code: "P0001", message: "CLINIC_NOT_FOUND" })).toBe("CLINIC_NOT_FOUND");
  });

  it("detects official SQLSTATE codes", () => {
    expect(isUniqueViolation({ code: "23505", message: "duplicate key" })).toBe(true);
    expect(
      extractUndefinedFunctionName('function seed_pami_cabecera_for_clinic(uuid) does not exist')
    ).toBe("seed_pami_cabecera_for_clinic");
    expect(
      extractMissingColumnKey('column "version" of relation "medical_orders" does not exist')
    ).toBe("medical_orders.version");
  });
});

describe("resolvePostgresUserMessage", () => {
  it("maps RPC codes to friendly messages", () => {
    expect(
      resolvePostgresUserMessage({
        code: "P0001",
        message: "La clínica activa no existe.",
        details: "CLINIC_NOT_FOUND",
      })
    ).toBe("La clínica activa no existe.");

    expect(
      resolvePostgresUserMessage({
        code: "P0001",
        message: "CLINIC_NOT_FOUND",
      })
    ).toBe("La clínica activa no existe.");
  });

  it("maps undefined function to migration hint", () => {
    expect(
      resolvePostgresUserMessage({
        code: "42883",
        message: "function seed_pami_cabecera_for_clinic(uuid) does not exist",
      })
    ).toContain("020_pami_cabecera");
  });

  it("maps undefined table to migration hint", () => {
    expect(
      resolvePostgresUserMessage({
        code: "42P01",
        message: 'relation "clinic_invitations" does not exist',
      })
    ).toContain("018");
  });
});
