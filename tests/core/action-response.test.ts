import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  actionError,
  clinicalRecordAccessDenied,
  importAccessDenied,
  permissionDenied,
  serviceDenied,
} from "@/core/actions/action-response";
import { parseActionInput, zodActionError } from "@/core/validations/action-parse";

describe("action-response helpers", () => {
  it("permissionDenied maps guard failures", () => {
    expect(permissionDenied({ ok: true })).toBeNull();
    expect(permissionDenied({ ok: false, error: "Sin permisos" })).toEqual({
      error: "Sin permisos",
    });
  });

  it("importAccessDenied preserves fallback", () => {
    expect(
      importAccessDenied({
        error: null,
        clinicId: null,
        userId: null,
      })
    ).toEqual({ error: "Sin permisos" });
  });

  it("clinicalRecordAccessDenied can skip userId", () => {
    expect(
      clinicalRecordAccessDenied(
        { error: null, clinicId: "abc", userId: null },
        { requireUserId: false }
      )
    ).toBeNull();
  });

  it("serviceDenied maps service errors", () => {
    expect(serviceDenied({ ok: false, error: "falló" })).toEqual({ error: "falló" });
  });
});

describe("action-parse helpers", () => {
  it("zodActionError uses first issue message", () => {
    const schema = z.object({ name: z.string().min(1, "Nombre requerido") });
    const parsed = schema.safeParse({ name: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(zodActionError(parsed.error)).toEqual({ error: "Nombre requerido" });
    }
  });

  it("parseActionInput returns data or error", () => {
    const schema = z.object({ id: z.string().uuid() });
    const ok = parseActionInput(schema, { id: "00000000-0000-4000-8000-000000000001" });
    expect(ok.ok).toBe(true);
    const bad = parseActionInput(schema, { id: "x" });
    expect("ok" in bad && bad.ok).toBe(false);
    if (!("ok" in bad) || !bad.ok) expect(bad).toEqual(actionError("Invalid UUID"));
  });
});
