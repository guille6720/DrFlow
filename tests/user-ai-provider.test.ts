import { describe, expect, it } from "vitest";

import {
  getDefaultModelForProvider,
  maskUserAiApiKey,
  USER_AI_PROVIDER_OPTIONS,
} from "@/lib/ai/user-ai-provider-types";

describe("user-ai-provider-types", () => {
  it("masks api keys leaving head and tail", () => {
    expect(maskUserAiApiKey("sk-abcdefghijklmnop")).toBe("sk-a…mnop");
    expect(maskUserAiApiKey("short")).toBe("••••••••");
  });

  it("lists supported providers with defaults", () => {
    expect(USER_AI_PROVIDER_OPTIONS.map((p) => p.id)).toEqual([
      "openai",
      "anthropic",
      "openai_compatible",
    ]);
    expect(getDefaultModelForProvider("anthropic")).toContain("claude");
  });
});

describe("buildClinicalCopilotContextSummary", () => {
  it("builds compact patient context", async () => {
    const { buildClinicalCopilotContextSummary } = await import(
      "@/lib/utils/clinical-copilot-responses"
    );
    const summary = buildClinicalCopilotContextSummary({
      patientName: "Ana García",
      lastConsultAt: "2026-01-15",
      recentConsultations: [{ dateLabel: "15/01", motive: "Control", diagnosis: "HTA" }],
    });
    expect(summary).toContain("Ana García");
    expect(summary).toContain("Control");
  });
});
