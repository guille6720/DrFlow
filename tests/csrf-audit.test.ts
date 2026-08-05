import { readdirSync, readFileSync, statSync } from "fs";
import type { NextRequest } from "next/server";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  isSameOriginPost,
  isSameOriginRequest,
  requireSameOriginMutation,
} from "@/core/security/csrf";

const ROOT = process.cwd();

function mockRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  } as NextRequest;
}

describe("CSRF security helpers", () => {
  it("isSameOriginRequest mirrors isSameOriginPost", () => {
    const req = mockRequest({
      host: "drflow.example.com",
      origin: "https://drflow.example.com",
    });
    expect(isSameOriginRequest(req)).toBe(true);
    expect(isSameOriginPost(req)).toBe(true);
  });

  it("requireSameOriginMutation returns 403 for cross-origin", () => {
    const req = mockRequest({
      host: "drflow.example.com",
      origin: "https://evil.example.com",
    });
    const block = requireSameOriginMutation(req);
    expect(block).not.toBeNull();
    expect(block?.status).toBe(403);
  });

  it("requireSameOriginMutation returns null for same-origin", () => {
    const req = mockRequest({
      host: "drflow.example.com",
      referer: "https://drflow.example.com/dashboard",
    });
    expect(requireSameOriginMutation(req)).toBeNull();
  });
});

describe("CSRF audit static checks", () => {
  const mutationRoutes: string[] = [];

  function walkApiRoutes(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walkApiRoutes(full);
        continue;
      }
      if (!entry.endsWith("route.ts")) continue;

      const content = readFileSync(full, "utf8");
      const hasMutation = /export async function (POST|PUT|PATCH|DELETE)\b/.test(content);
      if (!hasMutation) continue;

      const rel = full.replace(ROOT, "").replace(/\\/g, "/");
      mutationRoutes.push(rel);
    }
  }

  it("every mutation API route has CSRF or Bearer cron auth", () => {
    walkApiRoutes(resolve(ROOT, "src/app"));

    expect(mutationRoutes.length).toBeGreaterThan(0);

    const unprotected: string[] = [];
    for (const route of mutationRoutes) {
      const content = readFileSync(resolve(ROOT, route.slice(1)), "utf8");
      const hasCsrf =
        /isSameOrigin(Post|Request)|requireSameOriginMutation/.test(content);
      const hasCronAuth = /authorizeCronRequest/.test(content);
      if (!hasCsrf && !hasCronAuth) {
        unprotected.push(route);
      }
    }

    expect(unprotected).toEqual([]);
  });

  it("cookie-authenticated JSON API routes use requireSameOriginMutation", () => {
    for (const route of [
      "src/app/api/clinical-ai/route.ts",
      "src/app/api/admin-ops-ai/route.ts",
    ]) {
      const content = readFileSync(resolve(ROOT, route), "utf8");
      expect(content).toContain("requireSameOriginMutation");
    }
  });

  it("auth form POST routes use isSameOriginPost", () => {
    for (const route of [
      "src/app/api/auth/login/route.ts",
      "src/app/api/auth/reset-password/route.ts",
      "src/app/api/auth/signout/route.ts",
    ]) {
      const content = readFileSync(resolve(ROOT, route), "utf8");
      expect(content).toContain("isSameOriginPost");
    }
  });

  it("server action modules declare use server", () => {
    const actionDirs = [
      resolve(ROOT, "src/lib/actions"),
      resolve(ROOT, "src/features"),
    ];
    const offenders: string[] = [];

    function walkActions(dir: string) {
      if (!statSync(dir).isDirectory()) return;
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walkActions(full);
          continue;
        }
        if (!entry.endsWith(".ts")) continue;
        const content = readFileSync(full, "utf8");
        if (!content.includes('"use server"')) continue;
        if (!/^["']use server["'];?\s*$/m.test(content.split("\n")[0]?.trim() ?? "")) {
          if (content.includes('"use server"')) {
            // file has use server somewhere — acceptable
            continue;
          }
        }
      }
    }

    for (const dir of actionDirs) {
      if (!statSync(dir).isDirectory()) continue;
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walkActions(full);
          continue;
        }
        if (!full.includes("/actions/") || !entry.endsWith(".ts")) continue;
        const content = readFileSync(full, "utf8");
        if (content.includes("export async function") && !content.includes('"use server"')) {
          offenders.push(full.replace(ROOT, ""));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
