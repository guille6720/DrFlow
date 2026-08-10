/**
 * Refresh stabilization baseline from current codebase (grandfather oversized files).
 * Usage: node scripts/refresh-stabilization-baseline.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join, sep } from "path";
import { fileURLToPath } from "url";

import { lineCount, rel, SRC_ROOT, walkComponentFiles, walkDir } from "./lib/quality-scan.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(__dirname, "stabilization-baseline.json");

const components = {};
for (const filePath of walkComponentFiles(".tsx")) {
  const r = rel(filePath);
  const lines = lineCount(filePath);
  if (lines > 200) components[r] = lines;
}

const hooks = {};
const hookDirs = [
  `${SRC_ROOT}/lib/hooks`,
  `${SRC_ROOT}/core/hooks`,
  ...walkDir(`${SRC_ROOT}/features`).filter((d) => d.endsWith(`${sep}hooks`)),
];

for (const dir of hookDirs) {
  for (const filePath of walkDir(dir)) {
    if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) continue;
    const base = filePath.split(/[/\\]/).pop() ?? "";
    if (!base.startsWith("use-")) continue;
    const r = rel(filePath);
    const lines = lineCount(filePath);
    if (lines > 150) hooks[r] = lines;
  }
}

const baseline = {
  version: 1,
  description:
    "Grandfathered files exceeding stabilization targets (200-line components, 150-line hooks). Line counts must not increase.",
  componentMaxLines: 200,
  hookMaxLines: 150,
  components,
  hooks,
};

writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(
  `Updated ${BASELINE_PATH}: ${Object.keys(components).length} components, ${Object.keys(hooks).length} hooks`
);
