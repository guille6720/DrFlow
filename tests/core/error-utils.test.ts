import { describe, expect, it } from "vitest";

import {
  toError,
  toErrorMessage,
  toPostgrestErrorMessage,
} from "@/core/errors/error-utils";

describe("toErrorMessage", () => {
  it("reads Error.message", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("reads string values", () => {
    expect(toErrorMessage("plain")).toBe("plain");
  });

  it("reads object.message", () => {
    expect(toErrorMessage({ message: "from-object" })).toBe("from-object");
  });

  it("falls back for unknown values", () => {
    expect(toErrorMessage(undefined)).toBe("Unknown error");
    expect(toErrorMessage(42)).toBe("42");
  });
});

describe("toError", () => {
  it("returns the same Error instance", () => {
    const err = new Error("same");
    expect(toError(err)).toBe(err);
  });

  it("wraps unknown values", () => {
    expect(toError("wrapped").message).toBe("wrapped");
  });
});

describe("toPostgrestErrorMessage", () => {
  it("returns trimmed message when present", () => {
    expect(toPostgrestErrorMessage({ message: " duplicate " })).toBe("duplicate");
  });

  it("returns undefined for empty input", () => {
    expect(toPostgrestErrorMessage(null)).toBeUndefined();
    expect(toPostgrestErrorMessage({ message: "   " })).toBeUndefined();
  });
});
