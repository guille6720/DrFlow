import { SignatureImage } from "@/core/components/ui/signature-image";

import type { DocumentSignature } from "@/lib/utils/professional-signature-document";

type Props = {
  signature: DocumentSignature;
  className?: string;
};

export function DocumentSignatureBlock({ signature, className }: Props) {
  const text = signature.signatureText?.trim();
  const imageUrl = signature.signatureImageUrl?.trim();

  if (!text && !imageUrl) return null;

  return (
    <section className={className ? `mt-6 ${className}` : "mt-6"}>
      <h3 className="drflow-medical-order-doc-section-title text-xs font-bold uppercase tracking-wide">
        Firma del profesional
      </h3>
      <div className="mt-2 min-h-[72px] rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3">
        {imageUrl ? (
          <SignatureImage
            src={imageUrl}
            alt="Firma del profesional"
            className="mb-2 max-h-20 max-w-[220px] object-contain"
          />
        ) : null}
        {text ? (
          <p className="drflow-medical-order-doc-strong text-sm font-semibold">{text}</p>
        ) : null}
      </div>
    </section>
  );
}
