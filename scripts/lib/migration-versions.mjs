/**
 * Migration version rules for supabase/migrations.
 * Used by scripts/check-migration-versions.mjs and tests.
 *
 * Supabase CLI keys schema_migrations by the numeric prefix before the first "_"
 * (pattern ^([0-9]+)_.*\.sql$). Two files with the same prefix collide; files whose
 * prefix is not purely numeric are skipped by `supabase db push`.
 */

/**
 * Historical duplicates already applied in remote environments. Renaming them would
 * desync schema_migrations, so they stay as-is. The exact file set is frozen: a third
 * file with the same version is still reported.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const KNOWN_DUPLICATE_VERSIONS = Object.freeze({
  110: Object.freeze([
    "110_clinical_record_structured_dx_tx.sql",
    "110_skip_overlap_on_cancel.sql",
  ]),
});

/**
 * Historical files with a letter suffix (not CLI-tracked; applied manually / via run-migrations).
 * @type {readonly string[]}
 */
export const KNOWN_NON_CLI_FILES = Object.freeze([
  "004b_fix_appointment_status_cast.sql",
  "005b_pharmacology_seed_only.sql",
]);

const FILE_PATTERN = /^(\d+)([a-z]?)_[a-z0-9_]+\.sql$/;

/** @typedef {{ kind: "invalid-name" | "non-cli-version" | "duplicate-version"; version: string; files: string[] }} MigrationVersionIssue */

/**
 * @param {string} file
 * @returns {{ version: string; cliTracked: boolean } | null}
 */
export function parseMigrationFile(file) {
  const match = FILE_PATTERN.exec(file);
  if (!match) return null;
  return { version: `${match[1]}${match[2]}`, cliTracked: match[2] === "" };
}

/**
 * @param {readonly string[]} files — basenames in supabase/migrations
 * @returns {MigrationVersionIssue[]}
 */
export function findMigrationVersionIssues(files) {
  /** @type {MigrationVersionIssue[]} */
  const issues = [];
  /** @type {Map<string, string[]>} */
  const byVersion = new Map();

  for (const file of files.filter((f) => f.endsWith(".sql")).sort()) {
    const parsed = parseMigrationFile(file);
    if (!parsed) {
      issues.push({ kind: "invalid-name", version: "", files: [file] });
      continue;
    }
    if (!parsed.cliTracked && !KNOWN_NON_CLI_FILES.includes(file)) {
      issues.push({ kind: "non-cli-version", version: parsed.version, files: [file] });
    }
    byVersion.set(parsed.version, [...(byVersion.get(parsed.version) ?? []), file]);
  }

  for (const [version, group] of byVersion) {
    if (group.length < 2) continue;
    const allowed = KNOWN_DUPLICATE_VERSIONS[version] ?? [];
    const unexpected = group.some((f) => !allowed.includes(f));
    if (unexpected) {
      issues.push({ kind: "duplicate-version", version, files: group });
    }
  }

  return issues;
}

/**
 * Replay-order facts (informational): timestamp versions always sort after NNN versions.
 * @param {readonly string[]} files
 */
export function describeMigrationOrdering(files) {
  const parsed = files
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, parsed: parseMigrationFile(file) }))
    .filter((entry) => entry.parsed);
  const sequential = parsed.filter((e) => e.parsed.version.length <= 4);
  const timestamped = parsed.filter((e) => /^\d{14}$/.test(e.parsed.version));
  return {
    sequentialCount: sequential.length,
    timestampCount: timestamped.length,
    lastSequential: sequential.at(-1)?.file ?? null,
    firstTimestamp: timestamped[0]?.file ?? null,
  };
}
