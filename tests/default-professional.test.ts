import { describe, expect, it } from "vitest";

import { pickDefaultProfessionalId } from "@/lib/utils/default-professional";

const professionals = [{ id: "pro-a" }, { id: "pro-b" }];

describe("pickDefaultProfessionalId", () => {
  it("prefers explicit override when valid", () => {
    expect(pickDefaultProfessionalId("pro-a", professionals, "pro-b")).toBe("pro-b");
  });

  it("ignores override not in professionals list", () => {
    expect(pickDefaultProfessionalId("pro-a", professionals, "pro-missing")).toBe("pro-a");
  });

  it("uses clinic admin when no override", () => {
    expect(pickDefaultProfessionalId("pro-b", professionals)).toBe("pro-b");
  });

  it("falls back to first professional when admin is not listed", () => {
    expect(pickDefaultProfessionalId("pro-admin", professionals)).toBe("pro-a");
  });
});
