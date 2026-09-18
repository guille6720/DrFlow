#!/usr/bin/env node
/**
 * Production/build entry for Vercel + local.
 * On Vercel (8GB machines), prefer lower peak RAM to avoid SIGKILL OOM.
 */
import { spawnSync } from "child_process";

const onVercel = process.env.VERCEL === "1";
// Leave headroom for OS + Node on 8GB containers; higher heaps cause OOM kills.
const maxOldSpace = onVercel ? "5120" : process.env.NODE_OPTIONS_HEAP || "8192";

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, `--max-old-space-size=${maxOldSpace}`]
    .filter(Boolean)
    .join(" "),
};

const args = onVercel
  ? // Turbopack production build uses less peak RAM than webpack on large apps.
    ["build"]
  : ["build", "--webpack"];

console.log(
  `[next-build] vercel=${onVercel ? "yes" : "no"} args=${args.join(" ")} heap=${maxOldSpace}MB`
);

const result = spawnSync("npx", ["next", ...args], {
  stdio: "inherit",
  env,
  shell: true,
});

process.exit(result.status ?? 1);
