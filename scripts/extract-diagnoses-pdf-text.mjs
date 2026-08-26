/**
 * Extract full text from LISTA TABULAR ENFERMEDADES.pdf (CIE-10-ES).
 */
import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";

const pdfPath = path.join(process.cwd(), "data/lista-tabular-enfermedades.pdf");
const outPath = path.join(process.cwd(), "data/lista-tabular-enfermedades.raw.txt");

const buf = fs.readFileSync(pdfPath);
const parser = new PDFParse({ data: buf });
const result = await parser.getText();
const text = result.text ?? "";
fs.writeFileSync(outPath, text, "utf8");
console.log(
  JSON.stringify(
    {
      pages: result.total ?? result.pages?.length,
      chars: text.length,
      out: outPath,
    },
    null,
    2
  )
);
