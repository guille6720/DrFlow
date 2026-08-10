import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/supabase/admin", () => ({
  hasAdminClient: vi.fn(() => false),
  createAdminClient: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

vi.mock("@/core/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    storage: {
      from: () => ({
        createSignedUrls: async () => ({ data: [], error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: null }, error: null }),
      }),
    },
  })),
}));

describe("clinic metadata cache infrastructure", () => {
  it("exports TTL constants and cache helpers", async () => {
    const mod = await import("@/lib/server/clinic-metadata-unstable-cache");
    expect(mod.CLINIC_METADATA_TTL.professionals).toBe(300);
    expect(mod.withClinicMetadataCache).toBeTypeOf("function");
    expect(mod.withReferenceDataCache).toBeTypeOf("function");
  });

  it("includes clinic settings tag in metadata tags", async () => {
    const tags = await import("@/core/cache/cache-tags");
    expect(tags.clinicSettingsTag("c1")).toBe("clinic-c1-settings");
    expect(tags.clinicMetadataTags("c1")).toContain("clinic-c1-settings");
  });

  it("exports getCachedClinicSettings and admin templates helpers", async () => {
    const mod = await import("@/lib/server/cached-clinic-queries");
    expect(mod.getCachedClinicSettings).toBeTypeOf("function");
    expect(mod.getCachedClinicalTemplatesAdmin).toBeTypeOf("function");
  });
});
