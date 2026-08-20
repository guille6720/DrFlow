import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntitlementsProvider } from "@/core/components/entitlements/entitlements-provider";
import { FeatureGate } from "@/core/components/entitlements/feature-gate";
import { ENTITLEMENT_ENFORCEMENT_ENABLED } from "@/core/entitlements/enforcement";
import { FEATURES } from "@/core/entitlements/features";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

function snapshot(partial: Partial<ClientEntitlementsSnapshot>): ClientEntitlementsSnapshot {
  return {
    catalogAvailable: false,
    planKey: null,
    status: null,
    allowed: {},
    usage: {},
    limits: {},
    ...partial,
  };
}

describe("FeatureGate", () => {
  it("enables progressive enforcement", () => {
    expect(ENTITLEMENT_ENFORCEMENT_ENABLED).toBe(true);
  });

  it("never hides core clinical modules", () => {
    render(
      <FeatureGate feature={FEATURES.PATIENTS} allowed={false} fallback={<div>bloqueado</div>}>
        <div>pacientes</div>
      </FeatureGate>
    );
    expect(screen.getByText("pacientes")).toBeInTheDocument();
  });

  it("does not hide phase-29 deferred modules like PAMI", () => {
    render(
      <FeatureGate feature={FEATURES.PAMI} allowed={false} fallback={<div>bloqueado</div>}>
        <div>modulo pami</div>
      </FeatureGate>
    );
    expect(screen.getByText("modulo pami")).toBeInTheDocument();
    expect(screen.queryByText("bloqueado")).not.toBeInTheDocument();
  });

  it("hides enforced add-ons when explicitly not allowed", () => {
    render(
      <FeatureGate feature={FEATURES.CASH_REGISTER} allowed={false} fallback={<div>bloqueado</div>}>
        <div>modulo caja</div>
      </FeatureGate>
    );
    expect(screen.getByText("bloqueado")).toBeInTheDocument();
    expect(screen.queryByText("modulo caja")).not.toBeInTheDocument();
  });

  it("fails open when the commercial catalog is missing", () => {
    render(
      <EntitlementsProvider snapshot={snapshot({ catalogAvailable: false })}>
        <FeatureGate feature={FEATURES.CASH_REGISTER} fallback={<div>bloqueado</div>}>
          <div>modulo caja</div>
        </FeatureGate>
      </EntitlementsProvider>
    );
    expect(screen.getByText("modulo caja")).toBeInTheDocument();
  });

  it("hides enforced add-ons when the catalog denies the feature", () => {
    render(
      <EntitlementsProvider
        snapshot={snapshot({
          catalogAvailable: true,
          planKey: "basic",
          allowed: { [FEATURES.CASH_REGISTER]: false },
        })}
      >
        <FeatureGate feature={FEATURES.CASH_REGISTER} fallback={<div>catalogo deniega caja</div>}>
          <div>caja catalogo</div>
        </FeatureGate>
      </EntitlementsProvider>
    );
    expect(screen.getByText("catalogo deniega caja")).toBeInTheDocument();
    expect(screen.queryByText("caja catalogo")).not.toBeInTheDocument();
  });

  it("shows an upgrade notice by default when the catalog denies an enforced add-on", () => {
    render(
      <EntitlementsProvider
        snapshot={snapshot({
          catalogAvailable: true,
          planKey: "basic",
          allowed: { [FEATURES.CASH_REGISTER]: false },
        })}
      >
        <FeatureGate feature={FEATURES.CASH_REGISTER}>
          <div>caja catalogo</div>
        </FeatureGate>
      </EntitlementsProvider>
    );
    expect(screen.getByText(/Ver planes/)).toBeInTheDocument();
    expect(screen.queryByText("caja catalogo")).not.toBeInTheDocument();
  });

  it("shows metered usage when requested", () => {
    render(
      <EntitlementsProvider
        snapshot={snapshot({
          catalogAvailable: true,
          planKey: "premium",
          allowed: { [FEATURES.AI]: true, [FEATURES.AI_MONTHLY_REQUESTS]: true },
          usage: { [FEATURES.AI_MONTHLY_REQUESTS]: 12 },
          limits: { [FEATURES.AI_MONTHLY_REQUESTS]: 500 },
        })}
      >
        <FeatureGate feature={FEATURES.AI_MONTHLY_REQUESTS} showQuota>
          <div>gemini</div>
        </FeatureGate>
      </EntitlementsProvider>
    );
    expect(screen.getByText("gemini")).toBeInTheDocument();
    expect(screen.getByText(/12 \/ 500/)).toBeInTheDocument();
  });
});
