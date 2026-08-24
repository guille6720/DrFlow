import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntitlementsProvider } from "@/core/components/entitlements/entitlements-provider";
import { PlanCapHint } from "@/core/components/entitlements/plan-cap-hint";
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

describe("PlanCapHint", () => {
  it("hides when the catalog is missing or the cap is unlimited", () => {
    const { container: missing } = render(
      <EntitlementsProvider snapshot={snapshot({ catalogAvailable: false })}>
        <PlanCapHint feature={FEATURES.USERS_MAX} />
      </EntitlementsProvider>
    );
    expect(missing).toBeEmptyDOMElement();

    const { container: unlimited } = render(
      <EntitlementsProvider
        snapshot={snapshot({
          catalogAvailable: true,
          limits: { [FEATURES.USERS_MAX]: null },
        })}
      >
        <PlanCapHint feature={FEATURES.USERS_MAX} />
      </EntitlementsProvider>
    );
    expect(unlimited).toBeEmptyDOMElement();
  });

  it("shows the plan seat cap", () => {
    render(
      <EntitlementsProvider
        snapshot={snapshot({
          catalogAvailable: true,
          planKey: "basic",
          limits: { [FEATURES.USERS_MAX]: 3 },
        })}
      >
        <PlanCapHint feature={FEATURES.USERS_MAX} />
      </EntitlementsProvider>
    );
    expect(screen.getByText(/hasta 3/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tu plan/i })).toHaveAttribute("href", "/configuracion");
  });
});
