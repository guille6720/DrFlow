import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertSafeForExternalClinicalAi,
  CLINICAL_AI_SANITIZATION_BLOCKED_CODE,
  ClinicalAiSanitizationError,
  clinicalAiSanitizationFailureResponse,
  shouldBlockClinicalAiOutbound,
} from "@/lib/ai/clinical-ai-failsafe";
import {
  callGeminiApiSanitized,
  callVertexGeminiSanitized,
  prepareExternalClinicalAiPayload,
} from "@/lib/ai/external-clinical-ai-gateway.server";
import { buildPatientKnownIdentifiers } from "@/lib/ai/patient-ai-identifiers.server";
import * as sanitizeModule from "@/lib/ai/sanitize-clinical-ai-input";

vi.mock("@/lib/ai/vertex-gemini.server", () => ({
  callVertexGemini: vi.fn(async () => '{"summary":"ok","findings":[],"suggestions":[],"warnings":[]}'),
  callGeminiApi: vi.fn(async () => '{"summary":"ok","findings":[],"suggestions":[],"warnings":[]}'),
}));

const vertexModule = await import("@/lib/ai/vertex-gemini.server");

/** Synthetic Argentine physician free-text — NOT real patient data. */
const PHYSICIAN_CASE_AR = `
Analiza el caso de Carla Rodríguez DNI 27.456.789, CUIL 27-45678901-2,
domicilio calle Corrientes 1234 CABA, tel +54 9 11 5566-7788,
email carla.rodriguez@ejemplo.com.ar, credencial OSDE nro 9876543210123456.
Evolución: DM2 descompensada, HbA1c elevada.
`.trim();

const KNOWN_IDS = buildPatientKnownIdentifiers({
  firstName: "Carla",
  lastName: "Rodríguez",
  documentNumber: "27456789",
  email: "carla.rodriguez@ejemplo.com.ar",
  phone: "1155667788",
});

describe("clinical-ai fail-safe — Argentine identifier redaction", () => {
  it("removes all direct identifiers from realistic physician prompt before outbound AI", () => {
    const prepared = prepareExternalClinicalAiPayload({
      messages: [{ role: "user", content: PHYSICIAN_CASE_AR }],
      knownIdentifiers: KNOWN_IDS,
    });

    const outbound = prepared.messages[0]?.content ?? "";
    expect(outbound).not.toContain("Carla Rodríguez");
    expect(outbound).not.toContain("27.456.789");
    expect(outbound).not.toContain("27-45678901-2");
    expect(outbound).not.toContain("carla.rodriguez@ejemplo.com.ar");
    expect(outbound).not.toMatch(/5566-7788/);
    expect(outbound).not.toMatch(/9876543210123456/);
    expect(outbound).toContain("DM2");
    expect(prepared.status).toBe("partial");
  });

  it("assertSafeForExternalClinicalAi throws ClinicalAiSanitizationError when blocked", () => {
    vi.spyOn(sanitizeModule, "sanitizeClinicalAIInput").mockReturnValueOnce({
      sanitized: "DNI residual",
      status: "blocked",
      redactionCount: 1,
      blocked: true,
      blockReason: "Bloqueo de prueba",
    });

    expect(() => assertSafeForExternalClinicalAi("texto", {})).toThrow(ClinicalAiSanitizationError);
    vi.restoreAllMocks();
  });

  it("clinicalAiSanitizationFailureResponse returns stable error code", () => {
    const body = clinicalAiSanitizationFailureResponse("Bloqueo de prueba");
    expect(body.code).toBe(CLINICAL_AI_SANITIZATION_BLOCKED_CODE);
    expect(body.error).toBe("Bloqueo de prueba");
  });

  it("shouldBlockClinicalAiOutbound is false after full redaction of DNI", () => {
    expect(shouldBlockClinicalAiOutbound("DNI 30123456", {})).toBe(false);
  });
});

describe("clinical-ai fail-safe — external provider never called when blocked", () => {
  beforeEach(() => {
    vi.mocked(vertexModule.callVertexGemini).mockClear();
    vi.mocked(vertexModule.callGeminiApi).mockClear();
  });

  it("callVertexGeminiSanitized does NOT call Vertex when sanitization blocks", async () => {
    vi.spyOn(sanitizeModule, "sanitizeClinicalAIChatMessages").mockReturnValueOnce({
      messages: [],
      blocked: true,
      blockReason: "Fail-safe activado",
    });

    await expect(
      callVertexGeminiSanitized({
        systemPrompt: "test",
        messages: [{ role: "user", content: "cualquier texto" }],
      })
    ).rejects.toThrow(ClinicalAiSanitizationError);

    expect(vertexModule.callVertexGemini).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("callGeminiApiSanitized does NOT call Gemini API when sanitization blocks", async () => {
    vi.spyOn(sanitizeModule, "sanitizeClinicalAIChatMessages").mockReturnValueOnce({
      messages: [],
      blocked: true,
      blockReason: "Fail-safe activado",
    });

    await expect(
      callGeminiApiSanitized({
        apiKey: "test-key",
        systemPrompt: "test",
        messages: [{ role: "user", content: "cualquier texto" }],
      })
    ).rejects.toThrow(ClinicalAiSanitizationError);

    expect(vertexModule.callGeminiApi).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("callVertexGeminiSanitized calls Vertex only with sanitized payload", async () => {
    await callVertexGeminiSanitized({
      systemPrompt: "system",
      messages: [{ role: "user", content: "Juan Pérez DNI 12345678" }],
      knownIdentifiers: ["Juan Pérez"],
    });

    expect(vertexModule.callVertexGemini).toHaveBeenCalledTimes(1);
    const call = vi.mocked(vertexModule.callVertexGemini).mock.calls[0]?.[0];
    expect(call?.messages[0]?.content).not.toContain("Juan Pérez");
    expect(call?.messages[0]?.content).toContain("[REDACTADO]");
  });
});

describe("prepareExternalClinicalAiPayload — chat history", () => {
  it("sanitizes prior assistant and user turns", () => {
    const prepared = prepareExternalClinicalAiPayload({
      messages: [
        { role: "user", content: "Resumen de Martín López DNI 28456789" },
        { role: "assistant", content: "HTA estable" },
        { role: "user", content: "¿Alguna interacción con losartán?" },
      ],
      knownIdentifiers: buildPatientKnownIdentifiers({
        firstName: "Martín",
        lastName: "López",
        documentNumber: "28456789",
      }),
    });

    expect(prepared.messages[0]?.content).not.toContain("Martín López");
    expect(prepared.messages[0]?.content).not.toContain("28456789");
    expect(prepared.messages[0]?.content).toContain("[REDACTADO]");
    expect(prepared.messages[2]?.content).toContain("losartán");
  });
});
