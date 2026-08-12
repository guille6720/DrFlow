import { describe, expect, it } from "vitest";

import {
  getVertexGeminiConfig,
  isClinicGeminiConfigured,
  isVertexGeminiConfigured,
} from "@/lib/ai/vertex-gemini-config";

describe("vertex-gemini-config", () => {
  it("requires project and service account for Vertex", () => {
    expect(
      isVertexGeminiConfigured({
        VERTEX_AI_PROJECT: "drflow-prod",
      } as NodeJS.ProcessEnv)
    ).toBe(false);

    const config = getVertexGeminiConfig({
      VERTEX_AI_PROJECT: "drflow-prod",
      VERTEX_AI_SERVICE_ACCOUNT_JSON: '{"client_email":"x","private_key":"y"}',
      VERTEX_AI_LOCATION: "southamerica-east1",
      VERTEX_AI_MODEL: "gemini-1.5-pro",
    } as NodeJS.ProcessEnv);

    expect(config?.project).toBe("drflow-prod");
    expect(config?.location).toBe("southamerica-east1");
    expect(config?.model).toBe("gemini-1.5-pro");
  });

  it("accepts Gemini API key as clinic fallback", () => {
    expect(isClinicGeminiConfigured({ GEMINI_API_KEY: "AIza-test" } as NodeJS.ProcessEnv)).toBe(
      true
    );
  });
});
