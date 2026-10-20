/**
 * Extract static tutorial narration clips for offline Kokoro generation.
 * Usage: node --import tsx scripts/tutoriales/extract-narration-clips.mjs
 *    or: npm run tutoriales:extract-clips
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { listTutorials } from "../../src/features/tutoriales/registry.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = join(root, "scripts/tutoriales/generated");
const outPath = join(outDir, "narration-clips.json");

function normalizeSpokenText(input) {
  return input
    .replace(/\s+/g, " ")
    .replace(/NexClinic/gi, "Nex Clinic")
    .replace(/\/turnos\/agenda/gi, "agenda de turnos")
    .replace(/\/turnos\/nuevo/gi, "nuevo turno")
    .trim();
}

function textHash(text) {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

function collectClips(tutorials) {
  const byHash = new Map();

  for (const tutorial of tutorials) {
    for (const step of tutorial.steps ?? []) {
      const raw = (step.narration?.trim() || step.body || "").trim();
      if (!raw) continue;
      const text = normalizeSpokenText(raw);
      if (!text) continue;
      const hash = textHash(text);
      const entry = byHash.get(hash) ?? { textHash: hash, text, refs: [] };
      entry.refs.push({
        tutorialId: tutorial.id,
        clipId: step.id,
        kind: "step",
      });
      byHash.set(hash, entry);
    }
    for (const scene of tutorial.demoScenes ?? []) {
      const raw = (scene.narration || "").trim();
      if (!raw) continue;
      const text = normalizeSpokenText(raw);
      if (!text) continue;
      const hash = textHash(text);
      const entry = byHash.get(hash) ?? { textHash: hash, text, refs: [] };
      entry.refs.push({
        tutorialId: tutorial.id,
        clipId: scene.id,
        kind: "demo",
      });
      byHash.set(hash, entry);
    }
  }

  return [...byHash.values()].sort((a, b) => a.textHash.localeCompare(b.textHash));
}

const tutorials = listTutorials();
const clips = collectClips(tutorials);
mkdirSync(outDir, { recursive: true });
const payload = {
  generatedAt: new Date().toISOString(),
  clipCount: clips.length,
  voices: [
    { id: "dora", kokoroId: "ef_dora", label: "Dora" },
    { id: "alex", kokoroId: "em_alex", label: "Alex" },
    { id: "santa", kokoroId: "em_santa", label: "Santa" },
  ],
  clips,
};
writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
console.log(`Wrote ${clips.length} unique clips → ${outPath}`);
