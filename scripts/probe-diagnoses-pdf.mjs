/**
 * Probe LISTA TABULAR ENFERMEDADES.pdf structure (first pages only).
 */
import fs from "node:fs";
import path from "node:path";

async function main() {
  const pdfPath = path.join(process.cwd(), "data/lista-tabular-enfermedades.pdf");
  const buf = fs.readFileSync(pdfPath);
  const { PDFParse } = await import("pdf-parse");
  // pdf-parse v2 API
  let text = "";
  try {
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText({ first: 3 });
    text = typeof result === "string" ? result : result?.text ?? JSON.stringify(result).slice(0, 5000);
  } catch (e1) {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buf, { max: 3 });
      text = result.text;
      console.log("pages", result.numpages);
    } catch (e2) {
      console.error("parse failed", e1, e2);
      process.exit(1);
    }
  }
  console.log("--- TEXT START ---");
  console.log(text.slice(0, 8000));
  console.log("--- TEXT END ---");
  console.log("chars", text.length);
}

main();
