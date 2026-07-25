import "server-only";

import { access } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function resolvePdfWorkerHref(): Promise<string | undefined> {
  const candidates = [
    join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
    join(
      process.cwd(),
      "node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
    ),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return pathToFileURL(candidate).href;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

async function resolveStandardFontDataUrl(): Promise<string | undefined> {
  const dir = join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts");
  try {
    await access(dir);
    return pathToFileURL(join(dir, "/")).href;
  } catch {
    return undefined;
  }
}

async function extractWithPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const workerHref = await resolvePdfWorkerHref();
  if (workerHref) {
    PDFParse.setWorker(workerHref);
  }
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text ?? "";
}

async function extractWithPdfJsDirect(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerHref = await resolvePdfWorkerHref();
  if (workerHref) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerHref;
  }

  const standardFontDataUrl = await resolveStandardFontDataUrl();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
  });
  const doc = await loadingTask.promise;

  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const line = textContent.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) parts.push(line);
    page.cleanup();
  }

  await doc.destroy();
  return parts.join("\n");
}

/** Extrae texto de un PDF en entorno Node (local / Vercel). */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const attempts: Array<{ name: string; run: () => Promise<string> }> = [
    { name: "pdf-parse", run: () => extractWithPdfParse(buffer) },
    { name: "pdfjs-direct", run: () => extractWithPdfJsDirect(buffer) },
  ];

  for (const attempt of attempts) {
    try {
      const text = await attempt.run();
      if (text.trim().length > 0) {
        return text;
      }
    } catch (err) {
      console.error(`[clinical-pdf-import] ${attempt.name} failed:`, err);
    }
  }

  return "";
}
