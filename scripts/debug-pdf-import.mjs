import fs from "fs";
import { pathToFileURL } from "url";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node scripts/debug-pdf-import.mjs <path-to.pdf>");
  process.exit(1);
}

const { extractTextFromPdfBuffer } = await import(
  pathToFileURL(new URL("../src/lib/utils/pdf-text-extract.server.ts", import.meta.url)).href
);
const { extractPatientFromPdfText } = await import(
  pathToFileURL(new URL("../src/lib/utils/pdf-patient-extract.ts", import.meta.url)).href
);
const parseMod = await import(
  pathToFileURL(new URL("../src/lib/utils/clinical-export-pdf-parse.ts", import.meta.url)).href
);

const buf = fs.readFileSync(pdfPath);
const text = await extractTextFromPdfBuffer(buf);

console.log("TEXT_LENGTH", text?.length ?? 0);
if (!text?.trim()) {
  console.log("ERROR: No text extracted (scan/OCR?)");
  process.exit(0);
}

console.log("\n--- HEAD 3000 ---\n");
console.log(text.slice(0, 3000));
console.log("\n--- SAMPLE MIDDLE ---\n");
console.log(text.slice(3000, 6000));

const patient = extractPatientFromPdfText(text);
console.log("\nPATIENT", JSON.stringify(patient, null, 2));
console.log("LEGACY_DETECT", parseMod.isLegacyClinicalPdfExport(text));

const demo = parseMod.parseLegacyClinicalDemographics(text);
const evo = parseMod.parseLegacyClinicalEvolutionsWithFallback(text);
const diag = parseMod.parseLegacyClinicalChronicDiagnoses(text);

console.log("\nDEMO", JSON.stringify(demo, null, 2));
console.log("EVOLUTIONS", evo.length);
for (const [i, e] of evo.entries()) {
  console.log(`\n--- EVO ${i} ${e.consultationDate} ${e.professionalName} ---`);
  console.log("chief:", e.chief_complaint.slice(0, 120));
  console.log("evolution:", e.evolution.slice(0, 500));
  if (e.indications) console.log("indications:", e.indications.slice(0, 200));
}
console.log("\nDIAGNOSES", diag);
