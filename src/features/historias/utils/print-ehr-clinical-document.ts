import { printHtmlDocument } from "@/core/browser/print-html-document";

import {
  buildEhrPrintDocumentHtml,
  type EhrPrintDocumentInput,
} from "@/features/historias/utils/build-ehr-print-document-html";

export function printEhrClinicalDocument(input: EhrPrintDocumentInput) {
  const html = buildEhrPrintDocumentHtml(input);
  const title = `Historia clínica — ${input.patient.last_name}, ${input.patient.first_name}`;
  return printHtmlDocument({ html, title });
}

export type { EhrPrintDocumentInput };
