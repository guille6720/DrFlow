import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "public/superadmin-manual");
const outFile = path.join(
  process.cwd(),
  "src/core/components/superadmin/manual/manual-illustration-markup.ts"
);

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
const map = Object.fromEntries(
  files.map((f) => [f.replace(/\.svg$/, ""), fs.readFileSync(path.join(dir, f), "utf8").trim()])
);

const ids = Object.keys(map);
const body = `/** Inlined Superadmin manual SVGs (avoids broken <img> when CSP is applied to static SVG responses). */
export type ManualIllustrationId =
${ids.map((id) => `  | "${id}"`).join("\n")};

export const MANUAL_ILLUSTRATION_MARKUP: Record<ManualIllustrationId, string> = ${JSON.stringify(
  map,
  null,
  2
)};
`;

fs.writeFileSync(outFile, body, "utf8");
console.log(`Wrote ${ids.length} illustrations → ${path.relative(process.cwd(), outFile)}`);
