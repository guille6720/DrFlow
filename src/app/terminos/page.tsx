import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { LEGAL_TERMS_VERSION } from "@/lib/legal/documents";

export default function TerminosPage() {
  return (
    <div className="min-h-screen drflow-marketing">
      <header className="border-b border-slate-200 bg-white/90 px-4 py-4">
        <div className="mx-auto flex max-w-3xl justify-center py-2">
          <DrFlowLogo size="lg" href="/" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Términos del servicio DrFlow</h1>
        <p className="mt-1 text-sm text-slate-500">Versión {LEGAL_TERMS_VERSION} · Argentina</p>

        <section className="mt-8 space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            Estos términos regulan el uso de la plataforma DrFlow por profesionales y consultorios de
            salud. Al crear una cuenta, el titular declara actuar como responsable del tratamiento de
            datos de sus pacientes conforme la Ley 25.326 y normativa complementaria.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">1. Objeto</h2>
          <p>
            DrFlow provee herramientas de agenda, fichas de pacientes, historia clínica, recetas locales
            (Ley 25.649), portal de turnos y funciones administrativas. No reemplaza el criterio médico
            ni la relación médico-paciente.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">2. Responsabilidades del consultorio</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Veracidad de los datos cargados y consentimientos informados cuando corresponda.</li>
            <li>Custodia de credenciales de acceso del equipo.</li>
            <li>Cumplimiento de la Ley 26.529 (derechos del paciente) y confidencialidad profesional.</li>
            <li>
              Recetas emitidas: el usuario acepta que la funcionalidad es de borrador/local hasta
              homologación REFEPS/RENaPDiS si la clínica la obtiene por vías oficiales.
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900">3. DrFlow como encargado técnico</h2>
          <p>
            El proveedor aloja y procesa datos por instrucción del consultorio, con medidas de seguridad
            razonables (acceso autenticado, separación por clínica, registros de auditoría). No utiliza
            datos clínicos para publicidad.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">4. Disponibilidad y trial</h2>
          <p>
            El servicio se ofrece en modalidad SaaS. Los periodos de prueba comercial pueden finalizar
            según lo informado en la cuenta; vencido el trial, el acceso clínico puede restringirse
            manteniendo acceso a configuración, ayuda y exportación razonable de datos.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">5. Limitación</h2>
          <p>
            DrFlow no garantiza resultados clínicos ni validez legal de documentos más allá de lo
            declarado en cada módulo (p. ej. receta local vs. receta electrónica nacional). El
            consultorio mantiene la responsabilidad final frente al paciente y las autoridades.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">6. Contacto</h2>
          <p>
            Consultas contractuales: canal de contacto del proveedor DrFlow y/o administrador de la
            clínica titular de la cuenta.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/privacidad">
            <Button variant="outline">Política de privacidad</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline">Iniciar sesión</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
