import { printHtmlDocument } from "@/core/browser/print-html-document";

import {
  buildEhrPrintDocumentHtml,
  type EhrPrintDocumentInput,
} from "@/features/historias/utils/build-ehr-print-document-html";

import { buildClinicalHistoryFilename } from "@/lib/utils/clinical-history-filename";

export function printEhrClinicalDocument(input: EhrPrintDocumentInput) {
  const html = buildEhrPrintDocumentHtml(input);
  const consultationDate =
    input.scope === "day" && input.dayConsultations[0]
      ? input.dayConsultations[0].created_at
      : input.consultations[0]?.created_at ?? null;
  const title = buildClinicalHistoryFilename({
    last_name: input.patient.last_name,
    first_name: input.patient.first_name,
    document_number: input.patient.document_number,
    consultationDate,
  }).replace(/\.pdf$/i, "");
  return printHtmlDocument({ html, title });
}

export type { EhrPrintDocumentInput };
