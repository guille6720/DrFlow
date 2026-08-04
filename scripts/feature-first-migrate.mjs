#!/usr/bin/env node
/**
 * Feature First migration — moves code from src/lib to src/core, src/shared, src/features/*.
 * Creates transition re-exports at original src/lib paths.
 *
 * Usage: node scripts/feature-first-migrate.mjs
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

function listHooks(prefix) {
  const dir = resolve(ROOT, "src/lib/hooks");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".ts"));
}

function listUtils(prefix) {
  const dir = resolve(ROOT, "src/lib/utils");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".ts"));
}

// ── Core platform (directories) ───────────────────────────────────────────
for (const dir of [
  "supabase", "auth", "permissions", "security", "observability", "jobs",
  "legal", "accessibility", "validations", "trial", "manual", "qa", "booking", "enterprise", "theme",
]) {
  queue(`src/lib/${dir}`, `src/core/${dir}`);
}

queue("src/lib/env.server.ts", "src/core/env.server.ts");
queue("src/lib/app-release.ts", "src/core/app-release.ts");
queue("src/lib/actions/clinic-guard.ts", "src/core/actions/clinic-guard.ts");
queue("src/lib/repositories/types.ts", "src/core/repositories/types.ts");
queue("src/lib/services/types.ts", "src/core/services/types.ts");
queue("src/lib/services/clinical-access.service.ts", "src/core/services/clinical-access.service.ts");
queue("src/lib/features/flags", "src/features/flags/lib");

for (const f of [
  "use-login-form.ts", "use-register-clinic-form.ts", "use-restablecer-password.ts",
  "use-user-account-modal.ts", "use-client-mounted.ts",
  "use-command-palette-state.ts", "use-command-palette-keyboard.ts",
  "use-command-palette-patient-search.ts", "use-completed-ops-tasks.ts",
]) {
  queue(`src/lib/hooks/${f}`, `src/core/hooks/${f}`);
}

for (const f of ["cn.ts", "stabilization-limits.ts", "clinical-navigation.ts", "clinic-timezone.ts"]) {
  queue(`src/lib/utils/${f}`, `src/shared/utils/${f}`);
}

// ── Pacientes ─────────────────────────────────────────────────────────────
const pacientesFiles = [
  "actions/patients.ts", "actions/patient-chart-indicators.ts",
  "actions/patient-attachments.ts", "actions/patient-app-share.ts",
  "services/patients.service.ts", "services/patient-chart-indicators.service.ts",
  "repositories/patients.repository.ts", "repositories/patient-clinical-profile.repository.ts",
  "server/patient-clinical-profile.ts", "server/load-patient-workspace-page.ts",
  "server/load-patient-ehr-data.ts", "server/load-patient-audit-trail.ts",
  "server/load-pacientes-page.ts",
];
for (const f of pacientesFiles) queue(`src/lib/${f}`, `src/features/pacientes/${f}`);

for (const f of listHooks("use-patient-")) {
  queue(`src/lib/hooks/${f}`, `src/features/pacientes/hooks/${f}`);
}

for (const f of [
  ...listUtils("patient-"),
  "clinical-workspace-alerts.ts",
]) {
  queue(`src/lib/utils/${f}`, `src/features/pacientes/utils/${f}`);
}

queue("src/lib/constants/patient-workspace-tabs.ts", "src/features/pacientes/constants/patient-workspace-tabs.ts");

// ── Historias ─────────────────────────────────────────────────────────────
for (const [from, to] of [
  ["actions/clinical-records.ts", "actions/clinical-records.ts"],
  ["services/clinical-records.service.ts", "services/clinical-records.service.ts"],
  ["repositories/clinical-records.repository.ts", "repositories/clinical-records.repository.ts"],
  ["server/load-historias-page.ts", "server/load-historias-page.ts"],
  ["server/load-historia-detail-page.ts", "server/load-historia-detail-page.ts"],
]) {
  queue(`src/lib/${from}`, `src/features/historias/${to}`);
}

for (const f of [
  ...listHooks("use-consultation-"),
  "use-nueva-consulta-form.ts",
  "use-edit-consulta-form.ts",
]) {
  queue(`src/lib/hooks/${f}`, `src/features/historias/hooks/${f}`);
}

// ── Recetas ─────────────────────────────────────────────────────────────────
for (const f of [
  "actions/prescriptions.ts", "actions/medical-orders.ts",
  "services/prescriptions.service.ts", "services/medical-orders.service.ts",
  "repositories/prescription-drafts.repository.ts", "repositories/medical-orders.repository.ts",
  "server/load-recetas-page.ts",
]) {
  queue(`src/lib/${f}`, `src/features/recetas/${f}`);
}

for (const f of [...listHooks("use-prescription"), "use-prescriptions-orders-hub.ts"]) {
  queue(`src/lib/hooks/${f}`, `src/features/recetas/hooks/${f}`);
}

// ── Agenda ──────────────────────────────────────────────────────────────────
queue("src/lib/repositories/appointments.repository.ts", "src/features/agenda/repositories/appointments.repository.ts");
for (const f of [...listHooks("use-agenda"), ...listHooks("use-appointment")]) {
  queue(`src/lib/hooks/${f}`, `src/features/agenda/hooks/${f}`);
}

// ── Dashboard ───────────────────────────────────────────────────────────────
queue("src/lib/server/load-clinical-operations-dashboard.ts", "src/features/dashboard/server/load-clinical-operations-dashboard.ts");
for (const f of listUtils("clinical-ops")) {
  queue(`src/lib/utils/${f}`, `src/features/dashboard/utils/${f}`);
}
for (const f of listUtils("clinical-operations")) {
  queue(`src/lib/utils/${f}`, `src/features/dashboard/utils/${f}`);
}
for (const f of listUtils("admin-ops")) {
  queue(`src/lib/utils/${f}`, `src/features/dashboard/utils/${f}`);
}

// ── Configuracion ───────────────────────────────────────────────────────────
queue("src/lib/repositories/clinics.repository.ts", "src/features/configuracion/repositories/clinics.repository.ts");

// ── Caja ────────────────────────────────────────────────────────────────────
if (existsSync(resolve(ROOT, "src/lib/hooks/use-cash-register.ts"))) {
  queue("src/lib/hooks/use-cash-register.ts", "src/features/caja/hooks/use-cash-register.ts");
}

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
  const rel = relative(resolve(ROOT, "src"), absPath).replace(/\\/g, "/").replace(/\.tsx?$/, "");
  return `@/${rel}`;
}

function writeTransition(oldAbs, newAbs) {
  const importPath = toImportPath(newAbs);
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
    for (const { rel } of files) {
      const oldFile = join(from, rel);
      const newFile = join(to, rel);
      writeTransition(oldFile, newFile);
      moved.push({ from: oldFile, to: newFile });
    }
    console.log(`  dir: ${relative(ROOT, from)} → ${relative(ROOT, to)} (${files.length} files)`);
  } else {
    renameSync(from, to);
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
  console.log("\n🏗 Feature First migration\n");
  const allMoved = [];
  for (const { from, to } of MOVES) {
    allMoved.push(...moveEntry(from, to));
  }
  const replacements = buildReplacements(allMoved);
  const changed = updateAllImports(replacements);
  console.log(`\n📝 ${changed} file(s) imports updated`);
  console.log(`✅ ${allMoved.length} module(s) moved\n`);

  mkdirSync(resolve(ROOT, "coverage"), { recursive: true });
  writeFileSync(
    resolve(ROOT, "coverage/feature-first-migration.json"),
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
