import { describe, it, expect } from "vitest";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";

describe("formatClinicDateTime", () => {
  it("muestra 15:00 hs Argentina para 18:00 UTC", () => {
    expect(formatClinicDateTime("2026-06-19T18:00:00.000Z", "HH:mm 'hs'")).toBe("15:00 hs");
  });
});
