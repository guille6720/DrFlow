#!/usr/bin/env node
/**
 * Feature Based Components migration — moves domain components from src/components/*
 * to src/features/<domain>/components/ and shell components to src/core/components/.
 * Keeps src/components/ui for reusable primitives only.
 * Creates @deprecated transition re-exports at original paths.
 *
 * Usage: node scripts/feature-components-migrate.mjs
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());

/** @type {Array<{ from: string; to: string }>} */
const MOVES = [];

function queue(from, to) {
  MOVES.push({ from: resolve(ROOT, from), to: resolve(ROOT, to) });
}

// ── Shell / platform → core/components ─────────────────────────────────────
for (const dir of [
  "layout",
  "theme",
  "command-palette",
  "auth",
  "legal",
  "manual",
  "qa",
  "onboarding",
  "accessibility",
  "brand",
  "landing",
  "pwa",
  "trial",
  "updates",
  "booking",
]) {
  queue(`src/components/${dir}`, `src/core/components/${dir}`);
}

// ── Domain → features/*/components ─────────────────────────────────────────
const FEATURE_DIRS = {
  pacientes: "pacientes",
  historias: "historias",
  recetas: "recetas",
  agenda: "agenda",
  dashboard: "dashboard",
  configuracion: "configuracion",
  caja: "caja",
  portal: "portal",
  pami: "pami",
  pharmacology: "pharmacology",
  profesionales: "profesionales",
  telemedicina: "telemedicina",
  voice: "voice",
  plugins: "plugins",
  datos: "integraciones",
  pagos: "facturacion",
  secretaria: "administracion",
  atenciones: "administracion",
};

for (const [componentDir, feature] of Object.entries(FEATURE_DIRS)) {
  queue(`src/components/${componentDir}`, `src/features/${feature}/components/${componentDir}`);
}

// IA domain (clinical AI + admin ops copilot)
queue("src/components/clinical-workflow", "src/features/ia/components/clinical-workflow");
queue("src/components/admin-ops", "src/features/ia/components/admin-ops");

// Agenda-adjacent
queue("src/components/recordatorios", "src/features/agenda/components/recordatorios");
queue("src/components/reportes", "src/features/dashboard/components/reportes");

// Domain-specific file misplaced in ui/
queue(
  "src/components/ui/patient-whatsapp-button.tsx",
  "src/features/pacientes/components/patient-whatsapp-button.tsx"
);

function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

function isDir(p) {
  return existsSync(p) && statSync(p).isDirectory();
}

function walkTsFiles(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTsFiles(p, base, out);
    else if (/\.tsx?$/.test(name)) out.push({ abs: p, rel: relative(base, p) });
  }
  return out;
}

function toImportPath(absPath) {
  const relPath = relative(resolve(ROOT, "src"), absPath).replace(/\\/g, "/").replace(/\.tsx?$/, "");
  return `@/${relPath}`;
}

function writeTransition(oldAbs, newAbs) {
  const importPath = toImportPath(newAbs);
  const ext = oldAbs.endsWith(".tsx") ? ".tsx" : ".ts";
  const base = oldAbs.replace(/\.tsx?$/, "");
  const newExt = newAbs.endsWith(".tsx") ? ".tsx" : ".ts";
  if (base + ext !== oldAbs && !oldAbs.endsWith(newExt)) {
    // keep original extension on stub path
  }
  const content = `/** @deprecated Use ${importPath} */\nexport * from "${importPath}";\n`;
  ensureDir(oldAbs);
  writeFileSync(oldAbs, content, "utf8");
}

function isTransitionStub(filePath) {
  if (!existsSync(filePath) || isDir(filePath)) return false;
  const content = readFileSync(filePath, "utf8");
  return content.startsWith("/** @deprecated");
}

function moveEntry(from, to) {
  if (!existsSync(from)) {
    return [];
  }
  if (existsSync(to)) {
    console.warn(`  skip exists: ${relative(ROOT, to)}`);
    return [];
  }
  if (isTransitionStub(from)) {
    console.warn(`  skip stub: ${relative(ROOT, from)}`);
    return [];
  }

  ensureDir(to);
  const moved = [];

  if (isDir(from)) {
    const files = walkTsFiles(from).filter(({ abs }) => !isTransitionStub(abs));
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
    for (const { rel: fileRel } of files) {
      const oldFile = join(from, fileRel);
      const newFile = join(to, fileRel);
      writeTransition(oldFile, newFile);
      moved.push({ from: oldFile, to: newFile });
    }
    console.log(`  dir: ${relative(ROOT, from)} → ${relative(ROOT, to)} (${files.length} files)`);
  } else {
    cpSync(from, to);
    rmSync(from, { force: true });
    writeTransition(from, to);
    moved.push({ from, to });
    console.log(`  file: ${relative(ROOT, from)} → ${relative(ROOT, to)}`);
  }
  return moved;
}

function buildReplacements(moved) {
  const reps = moved.map(({ from, to }) => ({
    from: toImportPath(from),
    to: toImportPath(to),
  }));
  reps.sort((a, b) => b.from.length - a.from.length);
  return reps;
}

function updateAllImports(replacements) {
  const roots = ["src", "tests", "scripts"].map((d) => resolve(ROOT, d));
  let changed = 0;
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of walkTsFiles(root).map((x) => x.abs)) {
      let content = readFileSync(file, "utf8");
      if (content.startsWith("/** @deprecated")) continue;
      let next = content;
      for (const { from, to } of replacements) {
        if (next.includes(from)) next = next.split(from).join(to);
      }
      if (next !== content) {
        writeFileSync(file, next, "utf8");
        changed++;
      }
    }
  }
  return changed;
}

function main() {
  console.log("\n🧩 Feature Based Components migration\n");
  const allMoved = [];
  for (const { from, to } of MOVES) {
    allMoved.push(...moveEntry(from, to));
  }
  const replacements = buildReplacements(allMoved);
  const changed = updateAllImports(replacements);
  console.log(`\n📝 ${changed} file(s) imports updated`);
  console.log(`✅ ${allMoved.length} component module(s) moved\n`);

  mkdirSync(resolve(ROOT, "coverage"), { recursive: true });
  writeFileSync(
    resolve(ROOT, "coverage/feature-components-migration.json"),
    JSON.stringify(
      {
        movedCount: allMoved.length,
        importsUpdated: changed,
        moves: allMoved.map(({ from, to }) => ({
          from: relative(ROOT, from),
          to: relative(ROOT, to),
        })),
      },
      null,
      2
    ),
    "utf8"
  );
}

main();
