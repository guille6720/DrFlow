import { readdirSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  describeMigrationOrdering,
  findMigrationVersionIssues,
  KNOWN_DUPLICATE_VERSIONS,
  parseMigrationFile,
} from "../scripts/lib/migration-versions.mjs";

const repoMigrations = readdirSync(resolve(process.cwd(), "supabase/migrations"));

describe("migration versions (repository)", () => {
  it("has no new duplicate, non-CLI or invalid migration versions", () => {
    expect(findMigrationVersionIssues(repoMigrations)).toEqual([]);
  });

  it("documents the historical 110 duplicate exactly as it exists on disk", () => {
    const on110 = repoMigrations.filter((f) => f.startsWith("110_")).sort();
    expect(on110).toEqual([...KNOWN_DUPLICATE_VERSIONS[110]].sort());
  });

  it("replays timestamped migrations after all sequential ones", () => {
    const ordering = describeMigrationOrdering(repoMigrations);
    expect(ordering.lastSequential).toMatch(/^160_/);
    expect(ordering.firstTimestamp).toMatch(/^20260826114420_/);
  });
});

describe("findMigrationVersionIssues", () => {
  it("rejects a newly introduced duplicate version", () => {
    const issues = findMigrationVersionIssues(["161_a.sql", "161_b.sql", "162_c.sql"]);
    expect(issues).toEqual([
      { kind: "duplicate-version", version: "161", files: ["161_a.sql", "161_b.sql"] },
    ]);
  });

  it("rejects a duplicate timestamp version", () => {
    const issues = findMigrationVersionIssues([
      "20261014120000_one.sql",
      "20261014120000_two.sql",
    ]);
    expect(issues.map((i) => i.kind)).toEqual(["duplicate-version"]);
  });

  it("allows the documented 110 pair but rejects a third 110 file", () => {
    const known = [...KNOWN_DUPLICATE_VERSIONS[110]];
    expect(findMigrationVersionIssues(known)).toEqual([]);
    const issues = findMigrationVersionIssues([...known, "110_new_feature.sql"]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "duplicate-version", version: "110" });
  });

  it("rejects new letter-suffixed versions that the Supabase CLI would skip", () => {
    expect(findMigrationVersionIssues(["161b_hotfix.sql"])).toEqual([
      { kind: "non-cli-version", version: "161b", files: ["161b_hotfix.sql"] },
    ]);
    expect(
      findMigrationVersionIssues(["004b_fix_appointment_status_cast.sql"])
    ).toEqual([]);
  });

  it("rejects filenames without a numeric version prefix", () => {
    expect(findMigrationVersionIssues(["add_table.sql", "161-bad-name.sql"])).toHaveLength(2);
  });

  it("ignores non-SQL files", () => {
    expect(findMigrationVersionIssues(["README.md", "161_a.sql"])).toEqual([]);
  });
});

describe("parseMigrationFile", () => {
  it("parses sequential, suffixed and timestamp versions", () => {
    expect(parseMigrationFile("064_query_optimization.sql")).toEqual({
      version: "064",
      cliTracked: true,
    });
    expect(parseMigrationFile("005b_pharmacology_seed_only.sql")).toEqual({
      version: "005b",
      cliTracked: false,
    });
    expect(parseMigrationFile("20260928120000_feature_customizations.sql")).toEqual({
      version: "20260928120000",
      cliTracked: true,
    });
  });
});
