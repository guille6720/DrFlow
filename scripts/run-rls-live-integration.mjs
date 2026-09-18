#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["vitest", "run", "tests/cross-tenant-rls.integration.test.ts"],
  {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DRFLOW_RLS_INTEGRATION: "1" },
  }
);
process.exit(result.status ?? 1);
