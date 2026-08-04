import { describe, expect, it, afterEach } from "vitest";
import {
  getPublicSiteUrl,
  getSiteUrl,
  getSupabaseAnonKey,
  getSupabaseUrl,
  PUBLIC_SITE_FALLBACK,
} from "@/lib/supabase/env";

describe("supabase env helpers", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("getSupabaseUrl throws when missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => getSupabaseUrl()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("getSupabaseAnonKey throws on placeholder", () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_placeholder";
    expect(() => getSupabaseAnonKey()).toThrow(/PUBLISHABLE_KEY|ANON_KEY/);
  });

  it("getSiteUrl prefers configured URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://drflow.opusorg.com";
    expect(getSiteUrl()).toBe("https://drflow.opusorg.com");
  });

  it("getSiteUrl adds https to bare domain", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "drflow.opusorg.com";
    expect(getSiteUrl()).toBe("https://drflow.opusorg.com");
  });

  it("getPublicSiteUrl falls back when localhost configured", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(getPublicSiteUrl()).toBe(PUBLIC_SITE_FALLBACK);
    expect(getPublicSiteUrl("https://custom.example")).toBe("https://custom.example");
  });
});
