import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { HistoriaDetailPageData } from "@/features/historias/server/load-historia-detail-page";
import { DocumentSignatureBlock } from "@/features/recetas/components/recetas/document-signature-block";

import { Card } from "@/components/ui/card";
import { resolveClinicalRecordDocumentSignature } from "@/lib/utils/professional-signature-document";
import { sanitizeClinicalDisplayText } from "@/lib/utils/sanitize-clinical-display";

type Props = {
  record: HistoriaDetailPageData["record"];
  professional: HistoriaDetailPageData["professional"];
  professionalList: HistoriaDetailPageData["professionalList"];
};

export function HistoriaDetailConsultaCard({ record, professional, professionalList }: Props) {
  const signature = resolveClinicalRecordDocumentSignature({
    professionalId: String(record.professional_id),
    storedSignatureText: record.professional_signature,
    professionals: professionalList,
  });
  return (
    <Card title="Consulta">
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-medium">Fecha</dt>
          <dd>{format(new Date(record.created_at), "PPp", { locale: es })}</dd>
        </div>
        <div>
          <dt className="font-medium">Profesional</dt>
          <dd>{professional?.profiles?.full_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium">Motivo</dt>
          <dd className="whitespace-pre-wrap">
            {sanitizeClinicalDisplayText(record.chief_complaint) || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Diagnóstico</dt>
          <dd className="whitespace-pre-wrap">
            {sanitizeClinicalDisplayText(record.diagnosis) || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Evolución</dt>
          <dd className="whitespace-pre-wrap">
            {sanitizeClinicalDisplayText(record.evolution) || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Indicaciones</dt>
          <dd className="whitespace-pre-wrap">
            {sanitizeClinicalDisplayText(record.indications) || "—"}
          </dd>
        </div>
      </dl>

      <DocumentSignatureBlock signature={signature} />
    </Card>
  );
}
