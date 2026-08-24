import { describe, expect, it } from "vitest";

import {
  prepareExternalClinicalAiPayload,
  sanitizeClinicalContextBlock,
} from "@/lib/ai/external-clinical-ai-gateway.server";
import { buildPatientKnownIdentifiers } from "@/lib/ai/patient-ai-identifiers.server";

describe("prepareExternalClinicalAiPayload", () => {
  const identifiers = buildPatientKnownIdentifiers({
    firstName: "María",
    lastName: "González",
    documentNumber: "30123456",
  });

  it("passes through clean clinical text", () => {
    const prepared = prepareExternalClinicalAiPayload({
      messages: [{ role: "user", content: "Resumen de evolución: HTA controlada." }],
      knownIdentifiers: identifiers,
    });
    expect(prepared.messages[0]?.content).toContain("HTA controlada");
    expect(prepared.status).toBe("ok");
  });

  it("redacts known patient name in message", () => {
    const prepared = prepareExternalClinicalAiPayload({
      messages: [
        {
          role: "user",
          content: "Paciente María González con DNI 30.123.456 acude por control.",
        },
      ],
      knownIdentifiers: identifiers,
    });
    expect(prepared.messages[0]?.content).not.toContain("María González");
    expect(prepared.messages[0]?.content).toContain("[REDACTADO]");
    expect(prepared.status).toBe("partial");
  });

  it("redacts bare DNI in gateway payload without residual leak", () => {
    const prepared = prepareExternalClinicalAiPayload({
      messages: [{ role: "user", content: "DNI 30123456" }],
      knownIdentifiers: [],
    });
    expect(prepared.messages[0]?.content).toContain("[DNI]");
    expect(prepared.messages[0]?.content).not.toMatch(/30123456/);
    expect(prepared.status).toBe("partial");
  });

  it("sanitizes all messages in a conversation", () => {
    const prepared = prepareExternalClinicalAiPayload({
      messages: [
        { role: "user", content: "Consulta sobre María González" },
        { role: "assistant", content: "HTA en tratamiento" },
      ],
      knownIdentifiers: identifiers,
    });
    expect(prepared.messages[0]?.content).not.toContain("María González");
    expect(prepared.messages[1]?.content).toContain("HTA");
  });
});

describe("sanitizeClinicalContextBlock", () => {
  it("redacts CUIT in clinical context", () => {
    const out = sanitizeClinicalContextBlock("Profesional CUIT 20-12345678-3", []);
    expect(out).toContain("[CUIT/CUIL]");
    expect(out).not.toMatch(/20-12345678-3/);
  });
});

describe("buildPatientKnownIdentifiers", () => {
  it("includes name variants and document", () => {
    const ids = buildPatientKnownIdentifiers({
      firstName: "Juan",
      lastName: "Pérez",
      documentNumber: "12345678",
      email: "juan@mail.com",
    });
    expect(ids).toContain("Juan Pérez");
    expect(ids).toContain("Pérez, Juan");
    expect(ids).toContain("12345678");
    expect(ids).toContain("juan@mail.com");
  });
});
