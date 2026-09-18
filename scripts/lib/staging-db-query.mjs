#!/usr/bin/env node
/**
 * Run read-only SQL against linked STAGING via Supabase CLI.
 * Never prints connection strings or secrets.
 */
import { spawnSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { STAGING_REF } from "../supabase-project-refs.mjs";

export function stagingDbQuery(sql) {
  const tmp = resolve(
    process.cwd(),
    `.tmp-staging-query-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`
  );
  writeFileSync(tmp, sql, "utf8");
  try {
    const result = spawnSync(
      "npx",
      [
        "supabase",
        "db",
        "query",
        "--linked",
        "--project-ref",
        STAGING_REF,
        "--file",
        tmp,
        "--output-format",
        "json",
      ],
      { encoding: "utf8", shell: true }
    );
    const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (/_tag":"Error"|LegacyDbQueryUnexpectedStatusError|FATAL|permission denied/i.test(text)) {
      throw new Error(text.slice(0, 2000));
    }
    const jsonStart = text.lastIndexOf('{"boundary"');
    const alt = text.lastIndexOf('{\n  "boundary"');
    const idx = Math.max(jsonStart, alt);
    if (idx < 0) {
      if (result.status === 0 || /Initialising login role/.test(text)) {
        return { rows: [], raw: text };
      }
      throw new Error(text.slice(0, 2000) || "staging db query failed");
    }
    let depth = 0;
    let end = -1;
    const startBrace = text.indexOf("{", idx);
    for (let i = startBrace; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    return JSON.parse(text.slice(startBrace, end));
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}
