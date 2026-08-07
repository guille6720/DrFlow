#!/usr/bin/env npx tsx
/**
 * Genera docs/qa-auditoria-modulos.json y docs/qa-modules/<id>.json
 * desde src/core/qa/modular-audit-layers.ts (formato auth.json).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  QA_FUNCTIONAL_MODULES,
  QA_LAYER_LABELS,
  QA_LAYER_ORDER,
  type QaFunctionalModule,
  type QaModuleSummary,
} from "@/core/qa/modular-audit-layers";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMBINED_PATH = path.join(ROOT, "docs", "qa-auditoria-modulos.json");
const MODULES_DIR = path.join(ROOT, "docs", "qa-modules");

type StoredModule = {
  id: string;
  summary?: QaModuleSummary;
};

function loadExistingSummaries(): Record<string, QaModuleSummary> {
  if (!fs.existsSync(COMBINED_PATH)) return {};
  const parsed = JSON.parse(fs.readFileSync(COMBINED_PATH, "utf8")) as {
    modules?: StoredModule[];
  };
  const out: Record<string, QaModuleSummary> = {};
  for (const mod of parsed.modules ?? []) {
    if (mod.summary) out[mod.id] = mod.summary;
  }
  return out;
}

function resolveSummary(
  mod: QaFunctionalModule,
  existing: Record<string, QaModuleSummary>
): QaModuleSummary {
  if (mod.summary) return mod.summary;
  if (existing[mod.id]) return existing[mod.id];
  const primary =
    mod.layers.find((l) => l.layerId === "business") ?? mod.layers[0];
  return {
    what: primary?.what ?? mod.name,
    inputs: primary?.inputs ?? "",
    outputs: primary?.outputs ?? "",
  };
}

function toAuditModule(mod: QaFunctionalModule, existing: Record<string, QaModuleSummary>) {
  return {
    id: mod.id,
    name: mod.name,
    status: mod.status,
    summary: resolveSummary(mod, existing),
    layers: mod.layers,
    checks: mod.checks,
  };
}

const existingSummaries = loadExistingSummaries();
const modules = QA_FUNCTIONAL_MODULES.map((mod) => toAuditModule(mod, existingSummaries));

const combined = {
  project: "DrFlow",
  repo: "https://github.com/guille6720/DrFlow",
  production: "https://drflow.opusorg.com",
  generatedFrom: "src/core/qa/modular-audit-layers.ts",
  layerLabels: QA_LAYER_LABELS,
  layerOrder: QA_LAYER_ORDER,
  exportCodeCommand:
    "node scripts/export-qa-module-code.mjs <moduleId> [--layer=auth|business|data|ui]",
  modules,
};

fs.mkdirSync(MODULES_DIR, { recursive: true });
fs.writeFileSync(COMBINED_PATH, JSON.stringify(combined, null, 2), "utf8");
console.log(`Escrito: docs/qa-auditoria-modulos.json (${modules.length} módulos)`);

for (const mod of modules) {
  const payload = {
    project: combined.project,
    repo: combined.repo,
    production: combined.production,
    layerLabels: combined.layerLabels,
    layerOrder: combined.layerOrder,
    exportCodeCommand: `node scripts/export-qa-module-code.mjs ${mod.id}`,
    module: mod,
  };
  const out = path.join(MODULES_DIR, `${mod.id}.json`);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Escrito: docs/qa-modules/${mod.id}.json`);
}
