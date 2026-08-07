import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  copyTextToClipboard,
  copyTextWithExecCommand,
} from "@/core/browser/copy-to-clipboard";

describe("copyTextToClipboard", () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    document.execCommand = originalExecCommand;
  });

  it("uses Clipboard API on success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const result = await copyTextToClipboard("Planilla PAMI");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.method).toBe("clipboard-api");
    expect(writeText).toHaveBeenCalledWith("Planilla PAMI");
  });

  it("falls back to execCommand when Clipboard API rejects permission", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
      },
    });
    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyTextToClipboard("Planilla PAMI");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.method).toBe("exec-command");
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns permission message when API and fallback fail", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
      },
    });
    document.execCommand = vi.fn().mockReturnValue(false);

    const result = await copyTextToClipboard("Planilla PAMI");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("permission_denied");
      expect(result.message).toContain("bloqueó el acceso");
    }
  });

  it("uses execCommand when Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyTextToClipboard("Planilla PAMI");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.method).toBe("exec-command");
  });

  it("reports insecure context when neither path works", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = vi.fn().mockReturnValue(false);

    const result = await copyTextToClipboard("Planilla PAMI");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insecure_context");
      expect(result.message).toContain("HTTPS");
    }
  });

  it("rejects empty text", async () => {
    const result = await copyTextToClipboard("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty");
  });
});

describe("copyTextWithExecCommand", () => {
  it("returns false when execCommand throws", () => {
    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error("copy failed");
    });

    expect(copyTextWithExecCommand("texto")).toBe(false);
  });
});
