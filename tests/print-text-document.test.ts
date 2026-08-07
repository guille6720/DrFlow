import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isMobilePrintContext,
  printTextDocument,
} from "@/core/browser/print-text-document";

describe("printTextDocument", () => {
  const originalOpen = window.open;
  const mockPrint = vi.fn();
  let mockPopupWindow: Window;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPrint.mockReset();

    mockPopupWindow = {
      closed: false,
      document: {
        readyState: "complete",
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: mockPrint,
      close: vi.fn(),
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "afterprint") {
          (mockPopupWindow as Window & { __afterprint?: () => void }).__afterprint = handler;
        }
      }),
    } as unknown as Window;

    window.open = vi.fn(() => mockPopupWindow);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    window.open = originalOpen;
    vi.useRealTimers();
  });

  it("prints via popup on desktop when available", () => {
    const result = printTextDocument({ text: "Planilla PAMI", title: "Test" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.method).toBe("popup");
    expect(window.open).toHaveBeenCalledWith("about:blank", "_blank", "noopener,noreferrer");
    vi.advanceTimersByTime(150);
    expect(mockPrint).toHaveBeenCalled();
  });

  it("falls back to iframe when popup is blocked", () => {
    window.open = vi.fn(() => null);

    const frameWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        readyState: "complete",
      },
      focus: vi.fn(),
      print: mockPrint,
      addEventListener: vi.fn(),
    };

    const iframe = {
      contentWindow: frameWindow,
      isConnected: true,
      remove: vi.fn(),
      setAttribute: vi.fn(),
      style: {},
    };

    const createElement = vi.spyOn(document, "createElement").mockReturnValue(iframe as unknown as HTMLElement);
    const appendChild = vi.spyOn(document.body, "appendChild").mockImplementation(() => iframe as unknown as Node);

    const result = printTextDocument({ text: "Planilla PAMI" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.method).toBe("iframe");
    expect(createElement).toHaveBeenCalledWith("iframe");
    expect(appendChild).toHaveBeenCalled();

    createElement.mockRestore();
    appendChild.mockRestore();
  });

  it("reports failure when popup and iframe are unavailable", () => {
    window.open = vi.fn(() => null);

    const iframe = {
      contentWindow: null,
      isConnected: false,
      remove: vi.fn(),
      setAttribute: vi.fn(),
      style: {},
    };
    vi.spyOn(document, "createElement").mockReturnValue(iframe as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockImplementation(() => iframe as unknown as Node);

    const result = printTextDocument({ text: "Planilla PAMI" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("print_unavailable");
      expect(result.message).toContain("dispositivo");
    }
  });

  it("rejects empty content", () => {
    const result = printTextDocument({ text: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty");
  });

  it("closes popup after afterprint to avoid memory leaks", () => {
    printTextDocument({ text: "Planilla PAMI" });

    const handler = (mockPopupWindow as Window & { __afterprint?: () => void }).__afterprint;
    expect(handler).toBeTypeOf("function");
    handler?.();

    expect(mockPopupWindow.close).toHaveBeenCalled();
  });

  it("prefers iframe on mobile contexts", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    const frameWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        readyState: "complete",
      },
      focus: vi.fn(),
      print: mockPrint,
      addEventListener: vi.fn(),
    };

    const iframe = {
      contentWindow: frameWindow,
      isConnected: true,
      remove: vi.fn(),
      setAttribute: vi.fn(),
      style: {},
    };

    vi.spyOn(document, "createElement").mockReturnValue(iframe as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockImplementation(() => iframe as unknown as Node);

    const result = printTextDocument({ text: "Planilla PAMI" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.method).toBe("iframe");
    expect(window.open).not.toHaveBeenCalled();
  });
});

describe("isMobilePrintContext", () => {
  it("detects narrow viewports", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    expect(isMobilePrintContext()).toBe(true);
  });
});
