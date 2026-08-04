import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DrFlowLogo } from "@/core/components/brand/drflow-logo";
import { LegalDocumentView } from "@/core/components/legal/legal-document-view";
import { LEGAL_CONTENT_VERSION, legalDocuments } from "@/lib/legal/content";

export default function TerminosPage() {
  return (
    <div className="min-h-screen drflow-marketing">
      <header className="border-b border-slate-200 bg-white/90 px-4 py-4">
        <div className="mx-auto flex max-w-3xl justify-center py-2">
          <DrFlowLogo size="lg" href="/" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Términos y condiciones del servicio</h1>
        <p className="mt-1 text-sm text-slate-500">
          Versión {LEGAL_CONTENT_VERSION} · República Argentina
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          Documentación legal de DrFlow. Incluye los términos del servicio, políticas de privacidad,
          cookies, seguridad, backups y licencias de software.
        </p>

        <nav className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Índice</p>
          <ul className="mt-2 space-y-1 text-sm">
            {legalDocuments.map((doc) => (
              <li key={doc.id}>
                <a href={`#${doc.id}`} className="text-teal-700 hover:underline">
                  {doc.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 space-y-2">
          {legalDocuments.map((document) => (
            <LegalDocumentView key={document.id} document={document} />
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login">
            <Button variant="outline">Iniciar sesión</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Volver al inicio</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
