import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { EntitlementsProvider } from "@/core/components/entitlements/entitlements-provider";
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

describe("AddonUpgradeNotice", () => {
  it("renders nothing when the catalog is missing", () => {
    const { container } = render(
      <EntitlementsProvider snapshot={snapshot({ catalogAvailable: false })}>
        <AddonUpgradeNotice feature={FEATURES.API} />
      </EntitlementsProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("links to planes when the add-on is denied", () => {
    render(
      <EntitlementsProvider
        snapshot={snapshot({
          catalogAvailable: true,
          planKey: "basic",
          allowed: { [FEATURES.API]: false },
        })}
      >
        <AddonUpgradeNotice feature={FEATURES.API} />
      </EntitlementsProvider>
    );
    expect(screen.getByText(/API pública/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver planes/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/planes?modulo=")
    );
  });
});
