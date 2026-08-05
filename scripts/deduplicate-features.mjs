#!/usr/bin/env node
/**
 * Deduplicate features/components — centralize shared responsibilities.
 * Preserves public API via @deprecated transition stubs at legacy paths.
 *
 * Usage: node scripts/deduplicate-features.mjs
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
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

// ── Shared utilities ────────────────────────────────────────────────────────
queue("src/lib/utils/whatsapp.ts", "src/shared/utils/whatsapp.ts");

// ── IA domain types ─────────────────────────────────────────────────────────
queue("src/lib/utils/physician-assist-types.ts", "src/features/ia/types/physician-assist-types.ts");

// ── Voice domain lib ────────────────────────────────────────────────────────
queue("src/lib/features/voice-input.ts", "src/features/voice/lib/voice-input.ts");

// ── Patient chart types (disambiguate model vs view) ────────────────────────
queue(
  "src/features/pacientes/utils/patient-chart-types.ts",
  "src/features/pacientes/utils/patient-chart-model-types.ts"
);
queue(
  "src/features/pacientes/components/pacientes/patient-chart-types.ts",
  "src/features/pacientes/components/pacientes/patient-chart-view-types.ts"
);

// ── Stray hooks → feature ownership ─────────────────────────────────────────
queue("src/lib/hooks/use-professional-intake.ts", "src/features/profesionales/hooks/use-professional-intake.ts");
queue("src/lib/hooks/use-configuracion-navigator.ts", "src/features/configuracion/hooks/use-configuracion-navigator.ts");
queue("src/lib/hooks/use-speech-to-text.ts", "src/features/voice/hooks/use-speech-to-text.ts");

// ── Recetas order label util (extract from component utils) ─────────────────
queue(
  "src/features/recetas/components/recetas/prescriptions-orders-utils.ts",
  "src/features/recetas/utils/order-type-label.ts"
);

function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

function isDir(p) {
  return existsSync(p) && statSync(p).isDirectory();
}

function toImportPath(absPath) {
  return `@/${relative(resolve(ROOT, "src"), absPath).replace(/\\/g, "/").replace(/\.tsx?$/, "")}`;
}

function writeTransition(oldAbs, newAbs) {
  const importPath = toImportPath(newAbs);
  writeFileSync(oldAbs, `/** @deprecated Use ${importPath} */\nexport * from "${importPath}";\n`, "utf8");
}

function isTransitionStub(filePath) {
  if (!existsSync(filePath) || isDir(filePath)) return false;
  return readFileSync(filePath, "utf8").startsWith("/** @deprecated");
}

function moveFile(from, to) {
  if (!existsSync(from) || isTransitionStub(from)) return null;
  if (existsSync(to)) {
    console.warn(`  skip exists: ${relative(ROOT, to)}`);
    return null;
  }
  ensureDir(to);
  renameSync(from, to);
  writeTransition(from, to);
  console.log(`  ${relative(ROOT, from)} → ${relative(ROOT, to)}`);
  return { from, to };
}

function walkTsFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(p, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

function buildReplacements(moved) {
  return moved
    .map(({ from, to }) => ({ from: toImportPath(from), to: toImportPath(to) }))
    .sort((a, b) => b.from.length - a.from.length);
}

function updateAllImports(replacements, extraReplacements = []) {
  const reps = [...replacements, ...extraReplacements].sort((a, b) => b.from.length - a.from.length);
  const roots = ["src", "tests", "scripts"].map((d) => resolve(ROOT, d));
  let changed = 0;
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of walkTsFiles(root)) {
      let content = readFileSync(file, "utf8");
      if (content.startsWith("/** @deprecated")) continue;
      let next = content;
      for (const { from, to } of reps) {
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

function patchFile(relPath, transform) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) return;
  const next = transform(readFileSync(abs, "utf8"));
  if (next) writeFileSync(abs, next, "utf8");
}

function main() {
  console.log("\n🔬 Feature deduplication\n");
  const moved = [];
  for (const { from, to } of MOVES) {
    const m = moveFile(from, to);
    if (m) moved.push(m);
  }

  // prescriptions-orders-utils: keep re-export stub for orderTypeLabel only
  const ordersUtilsStub = resolve(ROOT, "src/features/recetas/components/recetas/prescriptions-orders-utils.ts");
  writeFileSync(
    ordersUtilsStub,
    `/** @deprecated Use @/features/recetas/utils/order-type-label */\nexport { orderTypeLabel } from "@/features/recetas/utils/order-type-label";\n`,
    "utf8"
  );

  // Recetas utils: only orderTypeLabel
  const orderLabelPath = resolve(ROOT, "src/features/recetas/utils/order-type-label.ts");
  if (existsSync(orderLabelPath)) {
    writeFileSync(
      orderLabelPath,
      `export function orderTypeLabel(type?: string): string {
  if (type === "referral") return "Derivación";
  if (type === "pami_form") return "Planilla PAMI";
  return "Estudios";
}
`,
      "utf8"
    );
  }

  const extraReplacements = [
    {
      from: "@/features/recetas/components/recetas/prescriptions-orders-utils",
      to: "@/features/recetas/utils/order-type-label",
    },
    {
      from: 'from "@/features/recetas/components/recetas/prescriptions-orders-utils"',
      to: 'from "@/features/recetas/utils/order-type-label"',
    },
  ];

  const replacements = buildReplacements(moved);
  const changed = updateAllImports(replacements, extraReplacements);

  // WhatsApp: remove duplicate buildOrderWhatsAppUrl usages
  patchFile("src/features/recetas/components/recetas/prescriptions-orders-patient-sidebar.tsx", (c) => {
    if (!c.includes("buildOrderWhatsAppUrl")) return null;
    let n = c.replace(
      /import \{([^}]*?)buildOrderWhatsAppUrl,\s*\n\s*orderTypeLabel,([^}]*)\} from "@\/features\/recetas\/utils\/order-type-label";/,
      'import { orderTypeLabel } from "@/features/recetas/utils/order-type-label";\nimport { buildWhatsAppShareUrl, buildWhatsAppUrl } from "@/shared/utils/whatsapp";'
    );
    n = n.replace(
      /import \{([^}]*?)orderTypeLabel,\s*\n\s*buildOrderWhatsAppUrl,([^}]*)\} from "@\/features\/recetas\/utils\/order-type-label";/,
      'import { orderTypeLabel } from "@/features/recetas/utils/order-type-label";\nimport { buildWhatsAppShareUrl, buildWhatsAppUrl } from "@/shared/utils/whatsapp";'
    );
    n = n.replace(/buildOrderWhatsAppUrl\(\s*([^,]+),\s*([^)]+)\)/g, (_, phone, text) => {
      return `(buildWhatsAppUrl(${phone}, ${text}) ?? buildWhatsAppShareUrl(${text}))`;
    });
    return n;
  });

  patchFile("src/features/recetas/components/recetas/share-prescription-buttons.tsx", (c) => {
    if (!c.includes("wa.me")) return null;
    let n = c.replace(
      'import { Mail, MessageCircle } from "lucide-react";',
      'import { buildWhatsAppShareUrl, buildWhatsAppUrl } from "@/shared/utils/whatsapp";\nimport { Mail, MessageCircle } from "lucide-react";'
    );
    n = n.replace(
      /const phone = patient\.phone\?\.replace\(\/\\D\/g, ""\);\s*\n\s*const whatsappUrl = phone\s*\n\s*\? `https:\/\/wa\.me\/\$\{phone\}\?text=\$\{encodeURIComponent\(summary\)\}`\s*\n\s*: `https:\/\/wa\.me\/\?text=\$\{encodeURIComponent\(summary\)\}`;/,
      "const whatsappUrl =\n    (patient.phone ? buildWhatsAppUrl(patient.phone, summary) : null) ??\n    buildWhatsAppShareUrl(summary);"
    );
    return n;
  });

  // Shared plugin/feature-flag providers (single export surface)
  const providersPath = resolve(ROOT, "src/features/plugins/providers.ts");
  writeFileSync(
    providersPath,
    `/** Shared React providers for clinic plugins and feature flags. */
export {
  ClinicPluginsProvider,
  useClinicPlugins,
  usePluginEnabled,
  ClinicFeaturesProvider,
  useClinicFeatures,
  useFeatureFlag,
} from "@/features/plugins/components/plugins/clinic-features-provider";
`,
    "utf8"
  );

  patchFile("src/features/plugins/index.ts", (c) =>
    c.replace(
      `export { ClinicPluginsProvider, useClinicPlugins, usePluginEnabled, ClinicFeaturesProvider, useClinicFeatures, useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";`,
      `export {
  ClinicPluginsProvider,
  useClinicPlugins,
  usePluginEnabled,
  ClinicFeaturesProvider,
  useClinicFeatures,
  useFeatureFlag,
} from "@/features/plugins/providers";`
    )
  );

  patchFile("src/features/flags/index.ts", (c) =>
    c.replace(
      `export {
  ClinicFeaturesProvider,
  ClinicPluginsProvider,
  useClinicFeatures,
  useClinicPlugins,
  usePluginEnabled,
  useFeatureFlag,
} from "@/features/plugins/components/plugins/clinic-features-provider";`,
      `export {
  ClinicFeaturesProvider,
  ClinicPluginsProvider,
  useClinicFeatures,
  useClinicPlugins,
  usePluginEnabled,
  useFeatureFlag,
} from "@/features/plugins/providers";`
    )
  );

  // observability + accessibility: canonical core paths
  patchFile("src/features/observability/index.ts", (c) =>
    c.replace(/@\/lib\/observability/g, "@/core/observability")
  );
  patchFile("src/features/accessibility/index.ts", (c) =>
    c.replace(/@\/lib\/accessibility/g, "@/core/accessibility")
  );

  // ia + voice public barrels → canonical paths
  patchFile("src/features/ia/index.ts", (c) =>
    c.replace(/@\/lib\/utils\/physician-assist-types/g, "@/features/ia/types/physician-assist-types")
  );
  patchFile("src/features/voice/index.ts", (c) =>
    c.replace(/@\/lib\/features\/voice-input/g, "@/features/voice/lib/voice-input")
  );

  // recetas index: export orderTypeLabel from utils
  patchFile("src/features/recetas/index.ts", (c) => {
    if (c.includes("orderTypeLabel")) return null;
    return c.trimEnd() + '\nexport { orderTypeLabel } from "@/features/recetas/utils/order-type-label";\n';
  });

  console.log(`\n📝 ${changed} file(s) imports updated`);
  console.log(`✅ ${moved.length} module(s) centralized\n`);

  writeFileSync(
    resolve(ROOT, "coverage/deduplication-migration.json"),
    JSON.stringify({ movedCount: moved.length, importsUpdated: changed, moves: moved.map(({ from, to }) => ({ from: relative(ROOT, from), to: relative(ROOT, to) })) }, null, 2),
    "utf8"
  );
}

main();
