import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import {
  PACIENTES_SEARCH_DEBOUNCE_MS,
  useDebouncedPacientesSearch,
} from "@/features/pacientes/hooks/use-debounced-pacientes-search";

describe("useDebouncedPacientesSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces URL updates while typing", () => {
    const { result } = renderHook(
      ({ urlQ, urlPatologia }) => useDebouncedPacientesSearch(urlQ, urlPatologia),
      { initialProps: { urlQ: "", urlPatologia: "" } }
    );

    act(() => {
      result.current.setQuery("g");
      result.current.setQuery("ga");
      result.current.setQuery("gar");
    });

    expect(push).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(PACIENTES_SEARCH_DEBOUNCE_MS);
    });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/pacientes?q=gar", { scroll: false });
  });

  it("does not overwrite local input when URL updates lag behind typing", () => {
    const { result, rerender } = renderHook(
      ({ urlQ, urlPatologia }) => useDebouncedPacientesSearch(urlQ, urlPatologia),
      { initialProps: { urlQ: "", urlPatologia: "" } }
    );

    act(() => {
      result.current.setQuery("garcia");
    });

    rerender({ urlQ: "gar", urlPatologia: "" });

    expect(result.current.query).toBe("garcia");

    act(() => {
      vi.advanceTimersByTime(PACIENTES_SEARCH_DEBOUNCE_MS);
    });

    expect(push).toHaveBeenCalledWith("/pacientes?q=garcia", { scroll: false });
  });

  it("syncs local input when the URL search query changes externally", () => {
    const { result, rerender } = renderHook(
      ({ urlQ, urlPatologia }) => useDebouncedPacientesSearch(urlQ, urlPatologia),
      { initialProps: { urlQ: "garcia", urlPatologia: "" } }
    );

    rerender({ urlQ: "lopez", urlPatologia: "" });

    expect(result.current.query).toBe("lopez");
  });

  it("submitSearch navigates immediately and cancels debounce", () => {
    const { result } = renderHook(() => useDebouncedPacientesSearch("", ""));

    act(() => {
      result.current.setQuery("perez");
    });

    act(() => {
      result.current.submitSearch();
    });

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/pacientes?q=perez", { scroll: false });

    act(() => {
      vi.advanceTimersByTime(PACIENTES_SEARCH_DEBOUNCE_MS);
    });

    expect(push).toHaveBeenCalledTimes(1);
  });
});
