/**
 * Scans src for CSS/Tailwind patterns that often cause unreadable text.
 * Run: npx tsx scripts/audit-problematic-css.mts
 *
 * Categories are advisory — not every hit is a defect (e.g. animate-ping).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");

const RULES: Array<{ id: string; severity: "high" | "medium" | "low"; re: RegExp; note: string }> = [
  {
    id: "text-white-alpha",
    severity: "high",
    re: /text-white\/([1-4]\d|[1-9])\b/,
    note: "White text with low alpha — usually fails contrast on light/pastel surfaces",
  },
  {
    id: "rgba-white-low",
    severity: "high",
    re: /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.[0-4]\d*\s*\)|rgb\(255 255 255\s*\/\s*0\.[0-4]/,
    note: "Low-alpha white color in CSS",
  },
  {
    id: "parent-opacity-low",
    severity: "high",
    re: /opacity:\s*0\.[0-4]\d*/,
    note: "Parent/element opacity < 0.5 washes nested text",
  },
  {
    id: "disabled-opacity-low",
    severity: "medium",
    re: /disabled:opacity-(?:[1-4]\d|50)\b/,
    note: "Disabled opacity on controls — prefer tokenized muted colors",
  },
  {
    id: "text-opacity-utility",
    severity: "medium",
    re: /\b(?:p|span|label|li|small|figcaption)[^"'\n]{0,80}opacity-(?:40|50|60|70|80)\b|opacity-(?:40|50|60|70|80)[^"'\n]{0,40}(?:text-|font-)/,
    note: "Opacity utility likely applied near text",
  },
  {
    id: "placeholder-opacity",
    severity: "medium",
    re: /placeholder:opacity-|::placeholder[^{]*\{[^}]*opacity:\s*0\.[0-8]/,
    note: "Placeholder opacity reduces already-soft text",
  },
  {
    id: "slate-300-400",
    severity: "low",
    re: /text-slate-(?:300|400)\b|text-gray-(?:300|400)\b/,
    note: "Tailwind muted slate — OK on dark navy; risky on white cards without remaps",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(p);
  }
  return out;
}

type Hit = { file: string; line: number; id: string; severity: string; sample: string };

const hits: Hit[] = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes("animate-ping") || line.includes("sr-only")) return;
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        hits.push({
          file: relative(process.cwd(), file).replace(/\\/g, "/"),
          line: i + 1,
          id: rule.id,
          severity: rule.severity,
          sample: line.trim().slice(0, 140),
        });
      }
    }
  });
}

const byId = new Map<string, number>();
for (const h of hits) byId.set(h.id, (byId.get(h.id) ?? 0) + 1);

console.log("Problematic CSS pattern scan (src/)\n");
for (const rule of RULES) {
  console.log(`${rule.severity.padEnd(6)} ${String(byId.get(rule.id) ?? 0).padStart(4)}  ${rule.id} — ${rule.note}`);
}
console.log(`\nTotal hits: ${hits.length}`);

const high = hits.filter((h) => h.severity === "high").slice(0, 40);
if (high.length) {
  console.log("\nHigh-severity samples:");
  for (const h of high) {
    console.log(`  ${h.file}:${h.line}  [${h.id}]  ${h.sample}`);
  }
}

process.exit(0);
