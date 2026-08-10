import { describe, expect, it } from "vitest";

import {
  buildPageMeta,
  CAJA_REPORTES_PAGE_SIZE,
  offsetRange,
  PAYMENTS_PAGE_SIZE,
  WAITING_LIST_PAGE_SIZE,
} from "@/core/supabase/pagination";

/** Simulates server-side page fetch cost: O(pageSize) rows per request regardless of total. */
function simulatedFetchMs(totalRows: number, pageSize: number, page: number): {
  rowsFetched: number;
  pages: number;
} {
  const pages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const { from, to } = offsetRange(safePage, pageSize);
  const rowsFetched = Math.min(pageSize, Math.max(0, totalRows - from));
  void to;
  return { rowsFetched, pages };
}

/** Naive "load all" baseline for comparison. */
function loadAllMs(totalRows: number): { rowsFetched: number } {
  return { rowsFetched: totalRows };
}

describe("global pagination performance model", () => {
  const datasets = [1_000, 10_000, 100_000];

  it.each(datasets)("offset pagination fetches only one page for %i rows", (total) => {
    const pageSize = WAITING_LIST_PAGE_SIZE;
    const { rowsFetched, pages } = simulatedFetchMs(total, pageSize, 1);
    const all = loadAllMs(total);

    expect(rowsFetched).toBeLessThanOrEqual(pageSize);
    expect(rowsFetched).toBeLessThan(all.rowsFetched);
    expect(buildPageMeta(total, 1, pageSize).totalPages).toBe(pages);
  });

  it("pagos page size stays bounded at scale", () => {
    for (const total of datasets) {
      const { rowsFetched } = simulatedFetchMs(total, PAYMENTS_PAGE_SIZE, 1);
      expect(rowsFetched).toBe(PAYMENTS_PAGE_SIZE);
    }
  });

  it("caja reportes avoids loading 500+ rows per view", () => {
    const total = 100_000;
    const beforeLimit = 500;
    const after = simulatedFetchMs(total, CAJA_REPORTES_PAGE_SIZE, 1);

    expect(after.rowsFetched).toBe(CAJA_REPORTES_PAGE_SIZE);
    expect(after.rowsFetched).toBeLessThan(beforeLimit);
    expect(after.pages).toBe(2_000);
  });
});

describe("pagination URL builders", () => {
  it("buildWaitingListUrl preserves search query", async () => {
    const { buildWaitingListUrl } = await import("@/features/turnos/server/load-waiting-list-page");
    expect(buildWaitingListUrl(2, "garcia")).toBe("/turnos/lista-espera?page=2&q=garcia");
  });

  it("buildCajaReportesUrl preserves date filters", async () => {
    const { buildCajaReportesUrl } = await import("@/features/facturacion/server/load-caja-reportes-page");
    expect(buildCajaReportesUrl("2026-01-01", "2026-01-31", 3)).toBe(
      "/caja/reportes?from=2026-01-01&to=2026-01-31&page=3"
    );
  });
});
