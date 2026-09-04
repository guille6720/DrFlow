import Link from "next/link";

import { DrFlowLogo } from "@/core/components/brand/drflow-logo";
import { LEGAL_PATIENT_NOTICE_VERSION } from "@/core/legal/documents";

import { Button } from "@/components/ui/button";

export default async function AvisoPacientePage({
  searchParams,
}: {
  searchParams: Promise<{ clinic?: string }>;
}) {
  const { clinic: clinicSlug } = await searchParams;

  return (
    <div className="min-h-screen bg-emerald-50">
      <header className="border-b border-emerald-100 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl justify-center py-2">
          <DrFlowLogo size="lg" href="/" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Información al paciente</h1>
        <p className="mt-1 text-sm text-slate-600">
          Versión {LEGAL_PATIENT_NOTICE_VERSION}
          {clinicSlug ? ` · Consultorio: ${clinicSlug}` : ""}
        </p>

        <section className="mt-8 space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            El consultorio médico al que solicitás turno es el <strong>responsable</strong> del
            tratamiento de tus datos personales y, cuando corresponda, de datos de salud. NexClinic es la
            herramienta tecnológica que utiliza el consultorio para organizar turnos y tu ficha.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Qué datos se usan al pedir turno</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Nombre, apellido, documento (DNI), teléfono y email (si lo indicás).</li>
            <li>Motivo del turno y horario elegido.</li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900">Para qué se usan</h2>
          <p>
            Gestionar tu solicitud, contactarte por el turno y mantener tu ficha en el consultorio,
            conforme la Ley 25.326 (protección de datos personales) y la Ley 26.529 (derechos del
            paciente).
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Tus derechos</h2>
          <p>
            Podés solicitar acceso, rectificación o supresión de tus datos contactando directamente al
            consultorio. Las historias clínicas ya emitidas pueden estar sujetas a plazos de conservación
            legales que limitan el borrado total.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Seguridad</h2>
          <p>
            El consultorio y su proveedor tecnológico aplican medidas para limitar el acceso a personal
            autorizado. No compartas tu DNI con terceros para cancelar turnos en tu nombre.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/privacidad">
            <Button variant="outline">Política de privacidad NexClinic</Button>
          </Link>
          {clinicSlug ? (
            <Link href={`/portal/${clinicSlug}`}>
              <Button>Volver al portal</Button>
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
