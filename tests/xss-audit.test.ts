import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  escapeHtml,
  sanitizeAuthErrorParam,
  sanitizeDisplayText,
  sanitizeExternalUrl,
  sanitizeInternalPath,
} from "@/core/security/xss";

describe("XSS security helpers", () => {
  it("strips HTML from display text", () => {
    expect(sanitizeDisplayText('<img src=x onerror=alert(1)> hola')).toBe("hola");
  });

  it("escapes HTML entities", () => {
    expect(escapeHtml(`<script>"x"</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot;&lt;/script&gt;"
    );
  });

  it("blocks javascript: external URLs", () => {
    expect(sanitizeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeExternalUrl("https://meet.jit.si/room")).toMatch(/^https:\/\//);
  });

  it("allows internal paths only", () => {
    expect(sanitizeInternalPath("/pacientes/abc")).toBe("/pacientes/abc");
    expect(sanitizeInternalPath("//evil.com")).toBeNull();
    expect(sanitizeInternalPath("javascript:alert(1)")).toBeNull();
  });

  it("sanitizes auth error query params", () => {
    expect(sanitizeAuthErrorParam("access_denied")).toContain("recuperación");
    expect(sanitizeAuthErrorParam(encodeURIComponent("<b>xss</b>"))).toBe("xss");
  });
});

describe("XSS audit static checks", () => {
  it("only allows dangerouslySetInnerHTML in theme bootstrap", () => {
    const root = resolve(process.cwd(), "src");
    const offenders: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(tsx|ts|jsx|js)$/.test(entry)) continue;
        const content = readFileSync(full, "utf8");
        if (!content.includes("dangerouslySetInnerHTML")) continue;
        const rel = full.replace(process.cwd(), "");
        const allowed =
          rel.includes("ui-theme-bootstrap-script") ||
          rel.includes("marketing-json-ld") ||
          rel.includes("marketing-theme-script");
        if (!allowed) {
          offenders.push(rel);
        }
      }
    }

    walk(root);
    expect(offenders).toEqual([]);
  });
});
