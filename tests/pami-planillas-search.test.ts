import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import {
  PAMI_PLANILLAS_SEARCH_DEBOUNCE_MS,
  useDebouncedPamiPlanillasSearch,
} from "@/features/pami/hooks/use-debounced-pami-planillas-search";

describe("useDebouncedPamiPlanillasSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces URL updates while typing", () => {
    const { result } = renderHook(
      ({ searchQuery }) => useDebouncedPamiPlanillasSearch(searchQuery),
      { initialProps: { searchQuery: "" } }
    );

    act(() => {
      result.current.setQ("g");
      result.current.setQ("ga");
      result.current.setQ("gar");
    });

    expect(push).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(PAMI_PLANILLAS_SEARCH_DEBOUNCE_MS);
    });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/pami/planillas?q=gar", { scroll: false });
  });

  it("cancels a pending debounced search when the query changes", () => {
    const { result } = renderHook(() => useDebouncedPamiPlanillasSearch(""));

    act(() => {
      result.current.setQ("gar");
    });

    act(() => {
      vi.advanceTimersByTime(PAMI_PLANILLAS_SEARCH_DEBOUNCE_MS - 50);
    });

    act(() => {
      result.current.setQ("garcia");
    });

    act(() => {
      vi.advanceTimersByTime(PAMI_PLANILLAS_SEARCH_DEBOUNCE_MS);
    });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/pami/planillas?q=garcia", { scroll: false });
  });

  it("does not navigate when the debounced query matches the current URL", () => {
    const { result } = renderHook(() => useDebouncedPamiPlanillasSearch("garcia"));

    act(() => {
      result.current.setQ("garcia");
    });

    act(() => {
      vi.advanceTimersByTime(PAMI_PLANILLAS_SEARCH_DEBOUNCE_MS);
    });

    expect(push).not.toHaveBeenCalled();
  });

  it("submitSearch navigates immediately and cancels debounce", () => {
    const { result } = renderHook(() => useDebouncedPamiPlanillasSearch(""));

    act(() => {
      result.current.setQ("perez");
    });

    act(() => {
      result.current.submitSearch();
    });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/pami/planillas?q=perez", { scroll: false });

    act(() => {
      vi.advanceTimersByTime(PAMI_PLANILLAS_SEARCH_DEBOUNCE_MS);
    });

    expect(push).toHaveBeenCalledTimes(1);
  });

  it("syncs local input when the URL search query changes", () => {
    const { result, rerender } = renderHook(
      ({ searchQuery }) => useDebouncedPamiPlanillasSearch(searchQuery),
      { initialProps: { searchQuery: "" } }
    );

    rerender({ searchQuery: "lopez" });

    expect(result.current.q).toBe("lopez");
  });
});
