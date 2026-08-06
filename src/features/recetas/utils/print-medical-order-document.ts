import { medicalOrderDocumentHeading } from "@/features/recetas/utils/medical-order-document-title";

export type MedicalOrderDocumentData = {
  orderType?: string;
  orderText: string;
  notes?: string | null;
  issuedAt: string;
  status?: string;
  patient: {
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date?: string | null;
    insurance_provider?: string | null;
    insurance_number?: string | null;
  };
  professional: {
    full_name: string;
    license_number?: string | null;
    specialty?: string | null;
  };
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMedicalOrderDocumentHtml(data: MedicalOrderDocumentData): string {
  const issued = new Date(data.issuedAt).toLocaleString("es-AR");
  const birth =
    data.patient.birth_date != null
      ? new Date(data.patient.birth_date).toLocaleDateString("es-AR")
      : null;
  const insurance = [data.patient.insurance_provider, data.patient.insurance_number]
    .filter(Boolean)
    .join(" — ");

  return `
    <article class="order-doc">
      <header class="order-doc-header">
        <p class="order-doc-kicker">República Argentina — DrFlow</p>
        <h1>${escapeHtml(medicalOrderDocumentHeading(data.orderType))}</h1>
        <p class="order-doc-meta">Fecha de emisión: ${escapeHtml(issued)}</p>
      </header>

      <section class="order-doc-block">
        <h2>Establecimiento</h2>
        <p><strong>${escapeHtml(data.clinic.name)}</strong></p>
        ${data.clinic.address ? `<p>${escapeHtml(data.clinic.address)}</p>` : ""}
        ${data.clinic.phone ? `<p>Tel: ${escapeHtml(data.clinic.phone)}</p>` : ""}
      </section>

      <section class="order-doc-block">
        <h2>Paciente</h2>
        <p><strong>${escapeHtml(data.patient.last_name)}, ${escapeHtml(data.patient.first_name)}</strong></p>
        <p>DNI: ${escapeHtml(data.patient.document_number)}</p>
        ${birth ? `<p>F. nac.: ${escapeHtml(birth)}</p>` : ""}
        ${insurance ? `<p>Cobertura: ${escapeHtml(insurance)}</p>` : ""}
      </section>

      <section class="order-doc-block">
        <h2>Profesional</h2>
        <p>Dr/a. ${escapeHtml(data.professional.full_name)}</p>
        ${data.professional.license_number ? `<p>Matrícula: ${escapeHtml(data.professional.license_number)}</p>` : ""}
        ${data.professional.specialty ? `<p>Especialidad: ${escapeHtml(data.professional.specialty)}</p>` : ""}
      </section>

      <section class="order-doc-block order-doc-body">
        <h2>Solicitud</h2>
        <pre>${escapeHtml(data.orderText)}</pre>
      </section>

      ${
        data.notes?.trim()
          ? `<section class="order-doc-block"><h2>Indicaciones para el paciente</h2><pre>${escapeHtml(data.notes.trim())}</pre></section>`
          : ""
      }

      <footer class="order-doc-footer">
        <p>Documento generado electrónicamente en DrFlow. Verifique datos del paciente antes de presentar.</p>
      </footer>
    </article>
  `;
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    color: #0f172a;
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.45;
  }
  .order-doc { max-width: 720px; margin: 0 auto; }
  .order-doc-header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 20px; }
  .order-doc-kicker { margin: 0 0 4px; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b; }
  .order-doc-header h1 { margin: 0; font-size: 22px; letter-spacing: 0.03em; }
  .order-doc-meta { margin: 8px 0 0; font-size: 12px; color: #475569; }
  .order-doc-block { margin-bottom: 18px; }
  .order-doc-block h2 {
    margin: 0 0 6px;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #0f766e;
  }
  .order-doc-block p { margin: 0 0 4px; font-size: 14px; }
  .order-doc-body pre {
    margin: 0;
    white-space: pre-wrap;
    font-family: inherit;
    font-size: 15px;
    line-height: 1.55;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #f8fafc;
  }
  .order-doc-footer {
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    font-size: 10px;
    color: #64748b;
  }
`;

export function printMedicalOrderDocument(data: MedicalOrderDocumentData): void {
  const html = buildMedicalOrderDocumentHtml(data);
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" /><title>${medicalOrderDocumentHeading(data.orderType)}</title><style>${PRINT_STYLES}</style></head><body>${html}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
}
