import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import {
  CLINICAL_RECORD_RETENTION_YEARS,
  LEGAL_PRIVACY_VERSION,
} from "@/lib/legal/documents";

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen drflow-mesh">
      <header className="border-b border-slate-200 bg-white/90 px-4 py-4">
        <div className="mx-auto flex max-w-3xl justify-center py-2">
          <DrFlowLogo size="lg" href="/" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Política de privacidad</h1>
        <p className="text-sm text-slate-500">
          Versión {LEGAL_PRIVACY_VERSION} · República Argentina
        </p>

        <section className="mt-8 space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            DrFlow trata datos personales y, en su caso, datos sensibles de salud, en el marco de la
            Ley 25.326 (Protección de Datos Personales), su decreto reglamentario y la Ley 26.529
            (Derechos del Paciente), y demás normativa aplicable.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Roles</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Responsable del tratamiento:</strong> el médico / consultorio titular de la
              cuenta (decide fines y medios respecto de sus pacientes).
            </li>
            <li>
              <strong>Encargado del tratamiento:</strong> el proveedor de DrFlow (alojamiento,
              copias de seguridad, operación técnica), actuando por instrucción del consultorio.
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900">Datos que se tratan</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Identificación y contacto (DNI, nombre, teléfono, email, domicilio).</li>
            <li>Datos de cobertura (obra social, PAMI, afiliación).</li>
            <li>Historia clínica: consultas, diagnósticos, evoluciones, adjuntos PDF.</li>
            <li>Turnos, cancelaciones y registro de auditoría del personal autorizado.</li>
            <li>Consentimientos registrados (fecha, versión del aviso, tipo).</li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900">Finalidades</h2>
          <p>
            Prestación del servicio de gestión clínica, turnos online, comunicación con pacientes,
            cumplimiento de obligaciones legales del consultorio y mejora de seguridad del sistema.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Base legal y consentimiento</h2>
          <p>
            El tratamiento se basa en la relación asistencial, el consentimiento cuando corresponda
            (p. ej. turno web), y el interés legítimo del consultorio en documentar la atención. Al
            solicitar turno, el paciente acepta el aviso específico en{" "}
            <Link href="/aviso-paciente" className="text-teal-700 underline">
              Información al paciente
            </Link>
            .
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Conservación</h2>
          <p>
            Las historias clínicas deben conservarse según criterios médico-legales (habitualmente al
            menos {CLINICAL_RECORD_RETENTION_YEARS} años). Otros datos se mantienen mientras la cuenta
            del consultorio esté activa o sea necesario para defensa de reclamos.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Derechos ARCO</h2>
          <p>
            El titular de los datos puede ejercer acceso, rectificación, actualización o supresión
            ante el consultorio. El consultorio puede exportar la ficha desde DrFlow (exportación
            ARCO). Reclamos ante la Agencia de Acceso a la Información Pública (AAIP) cuando
            corresponda.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Seguridad</h2>
          <p>
            Acceso autenticado, segregación por clínica (Row Level Security), HTTPS en producción,
            registros de auditoría en acciones sensibles. Se recomienda contraseñas robustas y no
            compartir usuarios.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Transferencias</h2>
          <p>
            Los datos pueden alojarse en proveedores cloud (p. ej. Supabase/Vercel) con contratos de
            procesamiento acordes. No se venden datos a terceros.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Contacto</h2>
          <p>
            Para ejercer derechos como paciente, contactá al consultorio donde te atendés. Para
            consultas sobre el funcionamiento de DrFlow, utilizá el canal del proveedor indicado en
            tu contrato o en la app de ayuda.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/terminos">
            <Button variant="outline">Términos del servicio</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline">Iniciar sesión</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
