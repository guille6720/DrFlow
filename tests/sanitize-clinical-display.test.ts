import { describe, expect, it } from "vitest";

import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";

describe("sanitizeClinicalDisplayText", () => {
  it("removes drapp CDN links and markers", () => {
    const raw =
      "[DRAPP:records/x] Evolución\nhttps://cdn.drapp.io/5bb271be.jpg\nControl OK";
    expect(sanitizeClinicalDisplayText(raw)).toBe("Evolución\nControl OK");
  });

  it("strips IMPORT prefix for display", () => {
    expect(sanitizeClinicalDisplayText("[IMPORT:records/1] Nota")).toBe("Nota");
  });
});
