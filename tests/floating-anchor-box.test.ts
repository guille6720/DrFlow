import { describe, expect, it } from "vitest";

import { computeFloatingAnchorBox } from "@/core/browser/floating-anchor-box";

describe("computeFloatingAnchorBox", () => {
  it("opens below when there is room", () => {
    const box = computeFloatingAnchorBox(
      { top: 200, bottom: 240, left: 40, width: 280 },
      { width: 1200, height: 800 }
    );
    expect(box.top).toBe(244);
    expect(box.width).toBe(280);
    expect(box.maxHeight).toBeGreaterThan(120);
  });

  it("opens above when the anchor is near the bottom", () => {
    const box = computeFloatingAnchorBox(
      { top: 720, bottom: 760, left: 40, width: 280 },
      { width: 1200, height: 800 }
    );
    expect(box.top).toBeLessThan(720);
    expect(box.maxHeight).toBeGreaterThan(120);
  });

  it("honors preferredMinWidth for narrow anchors", () => {
    const box = computeFloatingAnchorBox(
      { top: 200, bottom: 230, left: 40, width: 90 },
      { width: 1200, height: 800 },
      360,
      4,
      300
    );
    expect(box.width).toBe(300);
  });
});
