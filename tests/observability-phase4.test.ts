import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { toSafeUserError } from "@/core/errors/safe-error.server";
import { formatUserReferenceId, userFacingErrorMessage } from "@/core/observability/correlation-id";
import {
  classifyOperationDuration,
  OPERATION_THRESHOLDS_MS,
} from "@/core/observability/operation-thresholds";
import {
  redactStringValue,
  sanitizeMonitoringPayload,
  sanitizeSentryEventInPlace,
  sanitizeTelemetryMetadata,
} from "@/core/observability/sanitize-monitoring-payload";
import { createTraceId } from "@/core/observability/trace-id";

const root = process.cwd();

describe("Phase 4 PHI redaction", () => {
  it("redacts clinical and identity fields from monitoring payloads", () => {
    const clean = sanitizeMonitoringPayload({
      patient_name: "Juan Perez",
      document_number: "30123456",
      chief_complaint: "Dolor torácico",
      diagnosis: "IAM",
      email: "a@b.com",
      phone: "111",
      safe_scope: "clinical.persist",
      token: "secret",
    });
    expect(clean.patient_name).toBe("[redacted]");
    expect(clean.document_number).toBe("[redacted]");
    expect(clean.chief_complaint).toBe("[redacted]");
    expect(clean.diagnosis).toBe("[redacted]");
    expect(clean.email).toBe("[redacted]");
    expect(clean.phone).toBe("[redacted]");
    expect(clean.token).toBe("[redacted]");
    expect(clean.safe_scope).toBe("clinical.persist");
  });

  it("redacts bearer tokens and database URLs in string values", () => {
    expect(redactStringValue("Bearer eyJhbGciOiJIUzI1NiJ9.abc.def")).toBe("[redacted]");
    expect(redactStringValue("postgres://user:pass@host/db")).toBe("[redacted]");
  });

  it("sanitizeTelemetryMetadata returns undefined for empty input", () => {
    expect(sanitizeTelemetryMetadata(undefined)).toBeUndefined();
    expect(sanitizeTelemetryMetadata({})).toBeUndefined();
  });

  it("sanitizeSentryEventInPlace scrubs nested contexts", () => {
    const event = {
      extra: { diagnosis: "Hypertension" },
      contexts: { metadata: { evolution: "Patient stable" } },
    };
    sanitizeSentryEventInPlace(event);
    expect(event.extra?.diagnosis).toBe("[redacted]");
    expect(event.contexts?.metadata?.evolution).toBe("[redacted]");
  });
});

describe("Phase 4 correlation IDs", () => {
  it("createTraceId produces hex identifiers", () => {
    const id = createTraceId();
    expect(id).toMatch(/^[a-f0-9]{16}$/);
  });

  it("formatUserReferenceId exposes DF-prefixed short reference", () => {
    expect(formatUserReferenceId("a1b2c3d4e5f6789012345678abcdef01")).toBe("DF-CDEF01");
  });

  it("userFacingErrorMessage appends reference without stack traces", () => {
    const msg = userFacingErrorMessage("Algo salió mal.", "a1b2c3d4e5f6789012345678abcdef01");
    expect(msg).toContain("Referencia: DF-CDEF01");
    expect(msg).not.toMatch(/stack|Error:/i);
  });

  it("toSafeUserError strips internal details", () => {
    const safe = toSafeUserError("Error interno", "0000000000000000000000000000ab12cd");
    expect(safe.reference).toBe("DF-AB12CD");
    expect(safe.message).toContain("DF-AB12CD");
  });
});

describe("Phase 4 operation thresholds", () => {
  it("classifies read operations at warn/critical boundaries", () => {
    expect(classifyOperationDuration("dashboard.load", 999)).toBe("ok");
    expect(classifyOperationDuration("dashboard.load", 1000)).toBe("warn");
    expect(classifyOperationDuration("dashboard.load", 2000)).toBe("critical");
  });

  it("classifies write operations at warn/critical boundaries", () => {
    expect(classifyOperationDuration("clinical.consultation.save", 1499)).toBe("ok");
    expect(classifyOperationDuration("clinical.consultation.save", 1500)).toBe("warn");
    expect(classifyOperationDuration("clinical.consultation.save", 3000)).toBe("critical");
  });

  it("documents initial read/write thresholds", () => {
    expect(OPERATION_THRESHOLDS_MS.read.warn).toBe(1000);
    expect(OPERATION_THRESHOLDS_MS.write.critical).toBe(3000);
  });
});

describe("Phase 4 wiring guards", () => {
  it("logServerError sanitizes metadata before Sentry", () => {
    const src = readFileSync(join(root, "src/core/errors/log-error.server.ts"), "utf8");
    expect(src).toMatch(/sanitizeTelemetryMetadata/);
    expect(src).toMatch(/emitStructuredLog/);
    expect(src).toMatch(/getRequestTraceId/);
  });

  it("clinical persist route uses critical operation timing and safe user errors", () => {
    const src = readFileSync(
      join(root, "src/app/api/clinical-records/persist/route.ts"),
      "utf8"
    );
    expect(src).toMatch(/observeCriticalOperation/);
    expect(src).toMatch(/userFacingErrorMessage/);
    expect(src).not.toMatch(/err\.stack/);
  });

  it("Sentry server uses beforeSend sanitization and release tag", () => {
    const src = readFileSync(join(root, "src/core/observability/sentry.server.ts"), "utf8");
    expect(src).toMatch(/beforeSend/);
    expect(src).toMatch(/sanitizeSentryEventInPlace/);
    expect(src).toMatch(/release:/);
  });

  it("manual-image uses static illustration map only", () => {
    const component = readFileSync(
      join(root, "src/core/components/superadmin/manual/manual-image.tsx"),
      "utf8"
    );
    expect(component).toMatch(/MANUAL_ILLUSTRATION_MARKUP/);
    expect(component).not.toMatch(/props\.|children|userInput/);
    const markup = readFileSync(
      join(root, "src/core/components/superadmin/manual/manual-illustration-markup.ts"),
      "utf8"
    );
    expect(markup).toMatch(/Ilustracion - datos demo/);
    expect(markup).not.toMatch(/<script/i);
  });

  it("health endpoints avoid secret leakage in route handlers", () => {
    for (const file of [
      "src/app/api/health/route.ts",
      "src/app/api/health/live/route.ts",
      "src/app/api/health/ready/route.ts",
      "src/app/api/version/route.ts",
    ]) {
      const src = readFileSync(join(root, file), "utf8");
      expect(src).not.toMatch(/SERVICE_ROLE|SUPABASE_SERVICE/);
      expect(src).not.toMatch(/stack/i);
    }
  });
});
