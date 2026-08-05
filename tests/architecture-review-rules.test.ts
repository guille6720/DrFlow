import { describe, expect, it } from "vitest";

import {
  collectArchitectureTriggers,
  hasArchitectureReviewNote,
  matchArchitectureTrigger,
} from "../scripts/lib/architecture-review-rules.mjs";

describe("architecture-review-rules", () => {
  it("flags new migrations", () => {
    const hit = matchArchitectureTrigger("supabase/migrations/057_new_feature.sql", { isNew: true });
    expect(hit?.id).toBe("migration");
  });

  it("flags new API routes", () => {
    const hit = matchArchitectureTrigger("src/app/api/clinical-ai/route.ts", { isNew: true });
    expect(hit?.id).toBe("api-route");
  });

  it("flags large new components", () => {
    const hit = matchArchitectureTrigger("src/components/foo/big-panel.tsx", {
      isNew: true,
      lineCount: 240,
    });
    expect(hit?.id).toBe("large-component");
  });

  it("ignores small new components", () => {
    expect(
      matchArchitectureTrigger("src/components/foo/small.tsx", { isNew: true, lineCount: 80 })
    ).toBeNull();
  });

  it("collects unique triggers from a change set", () => {
    const triggers = collectArchitectureTriggers(
      [
        "supabase/migrations/057_x.sql",
        "src/app/api/foo/route.ts",
        "src/lib/utils/helper.ts",
      ],
      (file) => ({
        isNew: file.includes("api/") || file.includes("migrations/"),
        lineCount: 50,
      })
    );
    expect(triggers.map((t) => t.id).sort()).toEqual(["api-route", "migration"]);
  });

  it("detects ADR notes in the diff", () => {
    expect(
      hasArchitectureReviewNote(["docs/architecture-reviews/002-foo.md", "src/foo.ts"])
    ).toBe(true);
    expect(hasArchitectureReviewNote(["src/foo.ts"])).toBe(false);
  });
});
