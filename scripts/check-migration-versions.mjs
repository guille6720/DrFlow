#!/usr/bin/env node
/**
 * Fails when supabase/migrations introduces a duplicate or non-CLI migration version.
 * Read-only: inspects local filenames, never connects to a database.
 */
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  describeMigrationOrdering,
  findMigrationVersionIssues,
  KNOWN_DUPLICATE_VERSIONS,
  KNOWN_NON_CLI_FILES,
} from "./lib/migration-versions.mjs";

const files = readdirSync(resolve(process.cwd(), "supabase/migrations"));
const issues = findMigrationVersionIssues(files);
const ordering = describeMigrationOrdering(files);

console.log(
  `Migrations: ${ordering.sequentialCount} sequential + ${ordering.timestampCount} timestamped`
);
console.log(`Replay order: ${ordering.lastSequential} -> ${ordering.firstTimestamp}`);
console.log(
  `Known historical duplicates: ${Object.entries(KNOWN_DUPLICATE_VERSIONS)
    .map(([v, f]) => `${v} (${f.length} files)`)
    .join(", ")}`
);
console.log(`Known non-CLI files: ${KNOWN_NON_CLI_FILES.join(", ")}`);

if (issues.length > 0) {
  console.error("\nFAIL: migration version issues:");
  for (const issue of issues) {
    console.error(`  [${issue.kind}] ${issue.version} -> ${issue.files.join(", ")}`);
  }
  process.exit(1);
}

console.log("\nPASS: no new duplicate or invalid migration versions.");
