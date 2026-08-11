import { describe, expect, it } from "vitest";

import { checkPublicApiRateLimit } from "@/core/public-api/rate-limit";
import { hasPublicApiScope } from "@/core/public-api/types";
import {
  apiCreateAppointmentSchema,
  createApiKeySchema,
} from "@/core/validations/public-api-schemas";

describe("public API scopes", () => {
  it("checks required scope", () => {
    expect(hasPublicApiScope(["appointments:read"], "appointments:read")).toBe(true);
    expect(hasPublicApiScope(["appointments:read"], "appointments:write")).toBe(false);
  });
});

describe("createApiKeySchema", () => {
  it("requires at least one scope", () => {
    expect(createApiKeySchema.safeParse({ name: "Bot", scopes: [] }).success).toBe(false);
    expect(
      createApiKeySchema.safeParse({
        name: "Bot",
        scopes: ["appointments:read"],
      }).success
    ).toBe(true);
  });
});

describe("apiCreateAppointmentSchema", () => {
  it("validates appointment payload", () => {
    expect(
      apiCreateAppointmentSchema.safeParse({
        professional_id: "550e8400-e29b-41d4-a716-446655440000",
        start_at: "2026-08-15T14:00:00.000Z",
        first_name: "Juan",
        last_name: "Pérez",
        document_number: "12345678",
        phone: "01112345678",
      }).success
    ).toBe(true);
  });
});

describe("checkPublicApiRateLimit", () => {
  it("allows burst then blocks", () => {
    const keyId = "test-key-rate";
    for (let i = 0; i < 120; i++) {
      expect(checkPublicApiRateLimit(keyId)).toBe(true);
    }
    expect(checkPublicApiRateLimit(keyId)).toBe(false);
  });
});
