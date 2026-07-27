import fs from "fs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { extractPatientFromPdfText } from "../src/lib/utils/pdf-patient-extract";
import {
  isLegacyClinicalPdfExport,
  parseLegacyClinicalDemographics,
  parseLegacyClinicalEvolutionsWithFallback,
  parseLegacyClinicalChronicDiagnoses,
} from "../src/lib/utils/clinical-export-pdf-parse";

async function extractText(buffer: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    const text = result.text;
    const joined = Array.isArray(text) ? text.join("\n\n") : text;
    if (joined.trim()) return joined;
  } catch (e) {
    console.error("unpdf failed", e);
  }

  try {
    const { PDFParse } = await import("pdf-parse");
    const worker = join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
    try {
      await access(worker);
      PDFParse.setWorker(pathToFileURL(worker).href);
    } catch {
      /* no worker */
    }
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text ?? "";
  } catch (e) {
    console.error("pdf-parse failed", e);
    return "";
  }
}

async function main() {
  const pdfPath = process.argv[2]!;
  const buf = fs.readFileSync(pdfPath);
  const text = await extractText(buf);

  console.log("TEXT_LENGTH", text.length);
  if (!text.trim()) {
    console.log("No text — escaneo sin OCR.");
    return;
  }

  console.log("\n--- HEAD 4000 ---\n");
  console.log(text.slice(0, 4000));
  console.log("\n--- MID 4000 ---\n");
  console.log(text.slice(4000, 8000));

  const patient = extractPatientFromPdfText(text);
  console.log("\nPATIENT", JSON.stringify(patient, null, 2));
  console.log("LEGACY_DETECT", isLegacyClinicalPdfExport(text));

  const demo = parseLegacyClinicalDemographics(text);
  const evo = parseLegacyClinicalEvolutionsWithFallback(text);
  const diag = parseLegacyClinicalChronicDiagnoses(text);

  console.log("\nDEMO", JSON.stringify(demo, null, 2));
  console.log("EVOLUTIONS", evo.length);
  for (const [i, e] of evo.entries()) {
    console.log(`\n--- EVO ${i} ${e.consultationDate} | ${e.professionalName} ---`);
    console.log("chief:", e.chief_complaint.slice(0, 200));
    console.log("evolution:", e.evolution.slice(0, 1000));
  }
  console.log("\nDIAGNOSES", diag);
}

main();
