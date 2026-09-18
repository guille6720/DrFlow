import type { Metadata } from "next";

import { DrFlowLogo } from "@/core/components/brand/drflow-logo";
import { LegalDocumentView } from "@/core/components/legal/legal-document-view";
import { LEGAL_CONTENT_VERSION, privacyPolicyDocument } from "@/core/legal/content";

import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Política de privacidad y tratamiento de datos de NexClinic para consultorios en Argentina.",
  alternates: { canonical: "/privacidad" },
  robots: { index: true, follow: true },
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen drflow-marketing">
      <header className="border-b border-slate-200 bg-white/90 px-4 py-4">
        <div className="mx-auto flex max-w-3xl justify-center py-2">
          <DrFlowLogo size="lg" href="/" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Política de privacidad</h1>
        <p className="text-sm text-slate-500">
          Versión {LEGAL_CONTENT_VERSION} · República Argentina
        </p>

        <div className="mt-8">
          <LegalDocumentView document={privacyPolicyDocument} />
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/terminos" variant="outline">
            Ver toda la documentación legal
          </ButtonLink>
          <ButtonLink href="/login" variant="outline">
            Iniciar sesión
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
