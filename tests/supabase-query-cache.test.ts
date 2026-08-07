import { describe, expect, it, vi } from "vitest";

import { createSupabaseTestDouble } from "./helpers/mock-supabase-client";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock("@/core/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("cached clinic queries", () => {
  it("exports request-scoped cache helpers", async () => {
    const mod = await import("@/lib/server/cached-clinic-queries");
    expect(mod.getCachedClinicPlugins).toBeTypeOf("function");
    expect(mod.getCachedClinicFeatureFlags).toBeTypeOf("function");
    expect(mod.getCachedClinicFeatures).toBeTypeOf("function");
    expect(mod.getCachedActiveBookingSlug).toBeTypeOf("function");
    expect(mod.getCachedPortalContext).toBeTypeOf("function");
    expect(mod.getCachedClinicProfessionalsAgenda).toBeTypeOf("function");
    expect(mod.getCachedClinicProfessionalsList).toBeTypeOf("function");
    expect(mod.getCachedClinicLocations).toBeTypeOf("function");
    expect(mod.getCachedClinicSpecialties).toBeTypeOf("function");
    expect(mod.getCachedClinicalTemplates).toBeTypeOf("function");
    expect(mod.emptyClinicFeaturesContext).toBeTypeOf("function");
  });

  it("emptyClinicFeaturesContext returns plugin and flag maps", async () => {
    const { emptyClinicFeaturesContext } = await import("@/lib/server/cached-clinic-queries");
    const ctx = emptyClinicFeaturesContext();
    expect(Object.keys(ctx.plugins).length).toBeGreaterThan(0);
    expect(Object.keys(ctx.flags).length).toBeGreaterThan(0);
  });
});

describe("cache tags", () => {
  it("builds stable clinic and pathology tags", async () => {
    const tags = await import("@/core/cache/cache-tags");
    expect(tags.clinicPluginsTag("abc")).toBe("clinic-abc-plugins");
    expect(tags.clinicMetadataTags("abc")).toContain("clinic-abc-locations");
    expect(tags.pathologyDrugsTag("p1")).toBe("pathology-drugs-p1");
  });
});

describe("loadMonthlyClinicReport", () => {
  it("builds doctor breakdown and csv rows", async () => {
    const { loadMonthlyClinicReport } = await import("@/lib/server/load-monthly-clinic-report");

    function buildChain(_table: string) {
      const chain: Record<string, unknown> = {
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
      };
      chain.select = vi.fn((_cols: string, _opts?: { count?: string; head?: boolean }) => {
        chain.then = vi.fn((resolve: (v: unknown) => void) =>
          Promise.resolve(resolve({ count: 2, data: null, error: null }))
        );
        return chain;
      });
      return chain;
    }

    const supabase = {
      from: vi.fn((table: string) => buildChain(table)),
      rpc: vi.fn((fn: string) => {
        if (fn === "sum_paid_payments") {
          return Promise.resolve({ data: 500, error: null });
        }
        if (fn === "count_clinical_records_by_professional") {
          return Promise.resolve({
            data: [{ name: "Dr. Ana", count: 1 }],
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    const report = await loadMonthlyClinicReport(
      createSupabaseTestDouble(supabase),
      "clinic-1",
      "2026-01-01",
      "2026-01-31",
      "enero 2026"
    );

    expect(report.totalAppointments).toBe(2);
    expect(report.consultationsByDoctor).toEqual([{ name: "Dr. Ana", count: 1 }]);
    expect(report.estimatedRevenue).toBe(500);
    expect(report.csvRows.some((row) => row[0] === "Turnos totales")).toBe(true);
  });
});
