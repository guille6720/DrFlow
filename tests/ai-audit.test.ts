import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";

import {
  AI_AUDIT_ERROR_CODES,
  AI_AUDIT_METADATA_ALLOWLIST,
  buildAiAuditMetadata,
  buildAiAuditRecordParams,
  recordAiAuditEvent,
  sanitizeAiAuditMetadata,
} from "@/core/compliance/ai-audit";
import { buildAuditLogRow, deriveAuditModule } from "@/core/security/audit-log";

vi.mock("@/core/security/audit-service", () => ({
  recordAudit: vi.fn(async () => undefined),
}));

const { recordAudit } = await import("@/core/security/audit-service");

describe("AI audit metadata — privacy allowlist", () => {
  it("only persists allowlisted keys", () => {
    const meta = buildAiAuditMetadata({
      clinicId: "clinic-1",
      feature: "gemini_clinical_chat",
      provider: "vertex_gemini",
      model: "gemini-2.0-flash",
      task: "copilot_query",
      success: true,
      sanitizationStatus: "partial",
      redactionCount: 3,
      errorCode: undefined,
      durationMs: 420,
    });

    expect(Object.keys(meta).sort()).toEqual(
      [
        "provider",
        "model",
        "task",
        "success",
        "sanitization_status",
        "redaction_count",
        "error_code",
        "duration_ms",
      ].sort()
    );
    expect(meta.provider).toBe("vertex_gemini");
    expect(meta.redaction_count).toBe(3);
    expect(meta.duration_ms).toBe(420);
  });

  it("strips prompt/response/content keys via sanitizeAiAuditMetadata", () => {
    const stripped = sanitizeAiAuditMetadata({
      provider: "gemini_api",
      prompt: "Paciente Juan Pérez DNI 12345678",
      response: "Diagnóstico sugerido",
      message: "texto clínico",
      body: "evolución completa",
      success: false,
    });

    expect(stripped).toEqual({ provider: "gemini_api", success: false });
    expect(stripped).not.toHaveProperty("prompt");
    expect(stripped).not.toHaveProperty("response");
    expect(stripped).not.toHaveProperty("message");
    expect(stripped).not.toHaveProperty("body");
  });

  it("documents stable error codes for fail-safe integration", () => {
    expect(AI_AUDIT_ERROR_CODES.SANITIZATION_BLOCKED).toBe("sanitization_blocked");
    expect(AI_AUDIT_ERROR_CODES.NO_MODEL_RESPONSE).toBe("no_model_response");
  });

  it("allowlist matches exported constant", () => {
    expect(AI_AUDIT_METADATA_ALLOWLIST).toContain("sanitization_status");
    expect(AI_AUDIT_METADATA_ALLOWLIST).not.toContain("prompt");
  });
});

describe("AI audit — audit_logs row shape (DB integration contract)", () => {
  it("maps ai_request entity to ia module", () => {
    expect(deriveAuditModule("ai_request")).toBe("ia");
  });

  it("buildAiAuditRecordParams produces immutable audit_logs row", () => {
    const params = buildAiAuditRecordParams({
      clinicId: "clinic-ar-1",
      userId: "user-prof-1",
      patientId: "patient-1",
      feature: "clinical_ai_byok",
      provider: "openai",
      model: "gpt-4o-mini",
      task: "soap_draft",
      success: false,
      sanitizationStatus: "blocked",
      redactionCount: 2,
      errorCode: AI_AUDIT_ERROR_CODES.SANITIZATION_BLOCKED,
    });

    expect(params.module).toBe("ia");
    expect(params.entityType).toBe("ai_request");
    expect(params.entityId).toBe("clinical_ai_byok");
    expect(params.what).toBe("ai.clinical_ai_byok");
    expect(params.action).toBe("create");

    const row = buildAuditLogRow({
      userId: params.userId!,
      clinicId: params.clinicId,
      module: params.module,
      what: params.what,
      entityType: params.entityType,
      entityId: params.entityId,
      patientId: params.patientId,
      action: params.action,
      metadata: params.metadata,
      ipAddress: "200.58.123.45",
      userAgent: "DrFlow/1.0",
    });

    expect(row.module).toBe("ia");
    expect(row.entity_type).toBe("ai_request");
    expect(row.patient_id).toBe("patient-1");
    expect(row.metadata).toEqual({
      provider: "openai",
      model: "gpt-4o-mini",
      task: "soap_draft",
      success: false,
      sanitization_status: "blocked",
      redaction_count: 2,
      error_code: "sanitization_blocked",
      duration_ms: null,
    });
    expect(JSON.stringify(row.metadata)).not.toMatch(/DNI|@\w+\.|evolución/i);
  });

  it("recordAiAuditEvent delegates to recordAudit with ia module", async () => {
    vi.mocked(recordAudit).mockClear();

    await recordAiAuditEvent({
      clinicId: "clinic-1",
      userId: "user-1",
      feature: "clinical_ai_job",
      provider: "rule_based",
      task: "clinical_summary",
      success: true,
      sanitizationStatus: "ok",
    });

    expect(recordAudit).toHaveBeenCalledTimes(1);
    const call = vi.mocked(recordAudit).mock.calls[0]?.[0];
    expect(call?.module).toBe("ia");
    expect(call?.what).toBe("ai.clinical_ai_job");
    expect(call?.metadata?.provider).toBe("rule_based");
  });
});

describe("immutable audit_logs schema — ia module support", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/055_immutable_audit_logging.sql"),
    "utf8"
  );

  it("supports module column for ia grouping", () => {
    expect(sql).toMatch(/audit_logs[\s\S]*module TEXT/);
    expect(sql).toMatch(/idx_audit_logs_module_created/);
  });
});
