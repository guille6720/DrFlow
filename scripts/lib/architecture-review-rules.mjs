/**
 * Rules for when a human architecture review (ADR note) is required.
 * Used by scripts/architecture-review.mjs and tests.
 */

/** @typedef {{ id: string; reason: string; file: string }} ArchitectureTrigger */

/**
 * @param {string} relPath — posix path relative to repo root
 * @param {{ isNew?: boolean; lineCount?: number }} meta
 * @returns {ArchitectureTrigger | null}
 */
export function matchArchitectureTrigger(relPath, meta = {}) {
  const { isNew = false, lineCount = 0 } = meta;
  const p = relPath.replace(/\\/g, "/");

  if (/^supabase\/migrations\/\d+_.+\.sql$/.test(p)) {
    return { id: "migration", reason: "Database migration (schema / RLS / audit)", file: p };
  }

  if (isNew && /^src\/app\/api\/.+\/route\.ts$/.test(p)) {
    return { id: "api-route", reason: "New API route", file: p };
  }

  if (isNew && /^src\/features\/[^/]+\/.+/.test(p)) {
    return { id: "feature-module", reason: "New feature module slice", file: p };
  }

  if (isNew && /^src\/app\/\(dashboard\)\/[^/]+\/page\.tsx$/.test(p)) {
    return { id: "dashboard-route", reason: "New dashboard route", file: p };
  }

  if (isNew && p.startsWith("src/components/") && p.endsWith(".tsx") && lineCount > 200) {
    return {
      id: "large-component",
      reason: `New UI component (${lineCount} lines — extract hook / presentation)`,
      file: p,
    };
  }

  const orchestrators = [
    "src/lib/utils/clinical-ai-orchestrator.ts",
    "src/lib/utils/admin-ops-orchestrator.ts",
    "src/lib/utils/clinical-ai-llm-provider.server.ts",
  ];
  if (orchestrators.includes(p)) {
    return { id: "orchestrator", reason: "Clinical / ops orchestrator change", file: p };
  }

  if (/^supabase\/migrations\/\d+_.*(feature|flag|plugin).+\.sql$/i.test(p)) {
    return { id: "feature-flag", reason: "Feature flag / plugin migration", file: p };
  }

  return null;
}

/**
 * @param {string[]} changedFiles — relative paths
 * @param {(file: string) => { isNew: boolean; lineCount: number }} metaFor
 * @returns {ArchitectureTrigger[]}
 */
export function collectArchitectureTriggers(changedFiles, metaFor) {
  const seen = new Set();
  const triggers = [];

  for (const file of changedFiles) {
    const meta = metaFor(file);
    const hit = matchArchitectureTrigger(file, meta);
    if (hit && !seen.has(hit.id + hit.file)) {
      seen.add(hit.id + hit.file);
      triggers.push(hit);
    }
  }

  return triggers;
}

export function hasArchitectureReviewNote(changedFiles) {
  return changedFiles.some((f) => {
    const p = f.replace(/\\/g, "/");
    return /^docs\/architecture-reviews\/[^/]+\.md$/.test(p);
  });
}
