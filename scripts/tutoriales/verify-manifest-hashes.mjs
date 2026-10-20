import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function normalizeSpokenText(input) {
  return input
    .replace(/\s+/g, " ")
    .replace(/NexClinic/gi, "Nex Clinic")
    .replace(/\/turnos\/agenda/gi, "agenda de turnos")
    .replace(/\/turnos\/nuevo/gi, "nuevo turno")
    .trim();
}

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(root, "public/tutoriales/narration/v1/manifest.json"), "utf8")
);

let mismatches = 0;
let missing = 0;
for (const clip of manifest.clips) {
  const hash = createHash("sha256")
    .update(normalizeSpokenText(clip.text), "utf8")
    .digest("hex")
    .slice(0, 16);
  if (hash !== clip.textHash) {
    mismatches += 1;
    console.error("hash mismatch", clip.textHash, hash);
  }
  for (const voice of ["dora", "alex", "santa"]) {
    const rel = clip.files?.[voice];
    if (!rel || !existsSync(join(root, "public", rel.replace(/^\//, "")))) {
      missing += 1;
      console.error("missing file", voice, clip.textHash);
    }
  }
}
console.log(
  JSON.stringify({
    clips: manifest.clips.length,
    mismatches,
    missing,
    ok: mismatches === 0 && missing === 0,
  })
);
process.exit(mismatches || missing ? 1 : 0);
