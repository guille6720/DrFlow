export type DocumentSignature = {
  signatureText?: string | null;
  signatureImageUrl?: string | null;
};

export function buildDocumentSignatureHtml(signature: DocumentSignature): string {
  const text = signature.signatureText?.trim();
  const imageUrl = signature.signatureImageUrl?.trim();

  if (!text && !imageUrl) return "";

  const textHtml = text
    ? `<p class="order-doc-signature-text">${escapeHtml(text)}</p>`
    : "";
  const imageHtml = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="Firma del profesional" class="order-doc-signature-image" />`
    : "";

  return `
    <section class="order-doc-block order-doc-signature">
      <h2>Firma del profesional</h2>
      <div class="order-doc-signature-box">
        ${imageHtml}
        ${textHtml}
      </div>
    </section>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const DOCUMENT_SIGNATURE_PRINT_STYLES = `
  .order-doc-signature { margin-top: 28px; }
  .order-doc-signature-box {
    margin-top: 8px;
    min-height: 72px;
    padding-top: 8px;
  }
  .order-doc-signature-image {
    display: block;
    max-height: 72px;
    max-width: 220px;
    object-fit: contain;
    margin-bottom: 6px;
  }
  .order-doc-signature-text {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
  }
`;
