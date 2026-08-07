import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, logClientError } = vi.hoisted(() => ({
  refresh: vi.fn(),
  logClientError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/core/errors/log-error.client", () => ({
  logClientError,
}));

import { useAppRouterRefresh } from "@/core/hooks/use-app-router-refresh";

describe("useAppRouterRefresh", () => {
  beforeEach(() => {
    refresh.mockReset();
    logClientError.mockReset();
  });

  it("resolves ok after scheduling refresh", async () => {
    const { result } = renderHook(() => useAppRouterRefresh());

    let refreshResult: Awaited<ReturnType<typeof result.current.refreshSafely>> | undefined;
    await act(async () => {
      refreshResult = await result.current.refreshSafely({ scope: "test.refresh" });
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refreshResult).toEqual({ ok: true });
    expect(logClientError).not.toHaveBeenCalled();
  });

  it("logs and returns error when refresh throws synchronously", async () => {
    refresh.mockImplementation(() => {
      throw new Error("refresh boom");
    });

    const { result } = renderHook(() => useAppRouterRefresh());

    let refreshResult: Awaited<ReturnType<typeof result.current.refreshSafely>> | undefined;
    await act(async () => {
      refreshResult = await result.current.refreshSafely({
        scope: "test.refresh-throw",
        metadata: { source: "vitest" },
      });
    });

    expect(refreshResult?.ok).toBe(false);
    if (refreshResult && !refreshResult.ok) {
      expect(refreshResult.reason).toBe("refresh_threw");
      expect(refreshResult.message).toContain("no pudimos actualizar la pantalla");
    }
    expect(logClientError).toHaveBeenCalledWith(
      "test.refresh-throw",
      expect.any(Error),
      { source: "vitest" }
    );
  });
});
