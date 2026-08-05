import { describe, expect, it } from "vitest";

describe("Lighthouse SEO infrastructure", () => {
  it("generates robots.txt with sitemap reference", async () => {
    const { default: robots } = await import("@/app/robots");
    const rules = robots();
    expect(rules.sitemap).toMatch(/sitemap\.xml$/);
    expect(rules.rules).toBeDefined();
  });

  it("generates sitemap with public marketing routes", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = sitemap();
    const paths = entries.map((e) => new URL(e.url).pathname);
    expect(paths).toContain("/");
    expect(paths).toContain("/demo");
    expect(paths).toContain("/login");
  });

  it("allows robots.txt through middleware PWA bypass", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const middleware = readFileSync(
      resolve(process.cwd(), "src/core/supabase/middleware.ts"),
      "utf8"
    );
    expect(middleware).toContain('/robots.txt');
    expect(middleware).toContain('/sitemap.xml');
  });
});

describe("ButtonLink accessibility", () => {
  it("exports touch-target sizing helper", async () => {
    const { buttonSurfaceClassName } = await import("@/components/ui/button");
    expect(buttonSurfaceClassName("primary", "md")).toContain("min-h-11");
  });
});
