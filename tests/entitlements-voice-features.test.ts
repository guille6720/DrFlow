import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";
import { isVoiceInputEntitledBySnapshot } from "@/core/entitlements/voice-features";

function snapshot(allowed: Partial<Record<string, boolean>>): ClientEntitlementsSnapshot {
  return {
    catalogAvailable: true,
    planKey: "premium",
    status: "active",
    allowed: allowed as ClientEntitlementsSnapshot["allowed"],
    usage: {},
    limits: {},
  };
}

describe("isVoiceInputEntitledBySnapshot", () => {
  it("fails open when the catalog is missing", () => {
    expect(isVoiceInputEntitledBySnapshot(null)).toBe(true);
    expect(
      isVoiceInputEntitledBySnapshot({
        catalogAvailable: false,
        planKey: null,
        status: null,
        allowed: {},
        usage: {},
        limits: {},
      })
    ).toBe(true);
  });

  it("requires voice.enabled and ai.transcription when the catalog is live", () => {
    expect(
      isVoiceInputEntitledBySnapshot(
        snapshot({
          [FEATURES.VOICE]: true,
          [FEATURES.AI_TRANSCRIPTION]: true,
        })
      )
    ).toBe(true);

    expect(
      isVoiceInputEntitledBySnapshot(
        snapshot({
          [FEATURES.VOICE]: true,
          [FEATURES.AI_TRANSCRIPTION]: false,
        })
      )
    ).toBe(false);

    expect(
      isVoiceInputEntitledBySnapshot(
        snapshot({
          [FEATURES.VOICE]: false,
          [FEATURES.AI_TRANSCRIPTION]: true,
        })
      )
    ).toBe(false);
  });
});
