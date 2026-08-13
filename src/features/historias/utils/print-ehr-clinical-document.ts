import { printHtmlDocument } from "@/core/browser/print-html-document";

import {
  buildEhrPrintDocumentHtml,
  type EhrPrintDocumentInput,
} from "@/features/historias/utils/build-ehr-print-document-html";

import { clinicalHistoryPrintTitle } from "@/lib/utils/clinical-history-filename";

export function printEhrClinicalDocument(input: EhrPrintDocumentInput) {
  const html = buildEhrPrintDocumentHtml(input);
  const title = clinicalHistoryPrintTitle({
    last_name: input.patient.last_name,
    first_name: input.patient.first_name,
    document_number: input.patient.document_number,
  });
  return printHtmlDocument({ html, title });
}

export type { EhrPrintDocumentInput };
