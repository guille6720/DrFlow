/**
 * Phase 21 — Cancellation & consumer-rights posture tests.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  CANCELLATION_CAPABILITIES,
  CONSUMER_RIGHTS_LEGAL_REVIEW,
  evaluateCancellationConsumerRightsPosture,
  evaluateCancellationEligibility,
  subscriptionGrantsAccess,
} from "@/core/compliance/cancellation-consumer-rights";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("cancellation-consumer-rights policy", () => {
  it("marks B2B/B2C legal review and forbids code-only legal decisions", () => {
    const posture = evaluateCancellationConsumerRightsPosture();
    expect(posture.legalApplicabilityFromCodeAlone).toBe(false);
    expect(posture.legalReviewMarker).toBe(CONSUMER_RIGHTS_LEGAL_REVIEW);
    expect(posture.selfServeCancelRequired).toBe(true);
    expect(posture.unnecessaryObstaclesForbidden).toBe(true);
    expect(CONSUMER_RIGHTS_LEGAL_REVIEW).toContain("B2B/B2C");
  });

  it("lists cancellation capabilities including self-serve UI", () => {
    expect(CANCELLATION_CAPABILITIES.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        "self_serve_cancel_ui",
        "access_until_period_end",
        "no_dark_patterns",
        "service_cancellation_ui",
        "withdrawal_right_ui",
        "b2b_b2c_legal",
      ])
    );
    expect(
      CANCELLATION_CAPABILITIES.find((c) => c.id === "b2b_b2c_legal")?.technicalStatus
    ).toBe("external");
  });

  it("eligibility allows active/past_due; blocks manual and already canceled", () => {
    expect(evaluateCancellationEligibility({ status: "active" })).toEqual({
      ok: true,
      mode: "end_of_period",
    });
    expect(evaluateCancellationEligibility({ status: "past_due" }).ok).toBe(true);
    expect(evaluateCancellationEligibility({ status: "canceled" }).ok).toBe(false);
    expect(evaluateCancellationEligibility({ status: "manual" }).ok).toBe(false);
    expect(evaluateCancellationEligibility({ status: null }).ok).toBe(false);
  });

  it("subscriptionGrantsAccess keeps canceled paid-through until period end", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(
      subscriptionGrantsAccess({ status: "canceled", currentPeriodEnd: future })
    ).toBe(true);
    expect(
      subscriptionGrantsAccess({ status: "canceled", currentPeriodEnd: past })
    ).toBe(false);
    expect(
      subscriptionGrantsAccess({ status: "canceled", currentPeriodEnd: null })
    ).toBe(false);
    expect(
      subscriptionGrantsAccess({ status: "active", currentPeriodEnd: future })
    ).toBe(true);
  });
});

describe("fase 21 wiring (static)", () => {
  it("exposes cancel action and self-serve service", () => {
    const actions = read("src/lib/actions/billing.ts");
    expect(actions).toContain("cancelClinicSubscriptionAction");
    expect(actions).toContain("cancelClinicSubscriptionSelfServe");
    expect(actions).not.toMatch(/encuesta|llamá al|whatsapp obligatorio/i);

    const service = read("src/core/billing/subscription-service.ts");
    expect(service).toContain("cancelClinicSubscriptionSelfServe");
    expect(service).toContain("subscriptionGrantsAccess");
  });

  it("plan panel includes cancel UI without multi-step retention", () => {
    const panel = read(
      "src/features/configuracion/components/configuracion/clinic-plan-panel.tsx"
    );
    expect(panel).toContain("CancelSubscriptionButton");
    expect(panel).toContain("CONSUMER_RIGHTS_LEGAL_REVIEW");

    const btn = read("src/core/components/billing/cancel-subscription-button.tsx");
    expect(btn).toContain("Cancelar suscripción");
    expect(btn).toContain("Sí, cancelar");
    expect(btn).not.toMatch(/encuesta|¿por qué te vas\?/i);
  });

  it("migration grants canceled + future period_end access", () => {
    const sql = read("supabase/migrations/137_subscription_cancellation.sql");
    expect(sql).toContain("clinic_subscription_active");
    expect(sql).toContain("canceled");
    expect(sql).toContain("current_period_end");
  });

  it("doc marks legal review B2B/B2C", () => {
    const doc = read("docs/compliance/CANCELLATION-CONSUMER-RIGHTS-FASE-21.md");
    expect(doc).toContain(CONSUMER_RIGHTS_LEGAL_REVIEW);
    expect(doc).toMatch(/sin obstáculos|self-serve/i);
  });
});
