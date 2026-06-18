import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen drflow-mesh">
      <header className="border-b border-teal-100 bg-white/90 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2 text-teal-900">
          <Activity className="h-5 w-5" />
          <span className="font-bold">DrFlow</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 prose prose-slate">
        <h1 className="text-2xl font-bold text-slate-900">Política de privacidad (piloto)</h1>
        <p className="text-sm text-slate-500">Última actualización: junio 2025 · Versión piloto con médico de cabecera PAMI</p>

        <section className="mt-8 space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            DrFlow procesa datos de salud conforme Ley 25.326 (Protección de Datos Personales)
            y Ley 26.529 (Derechos del Paciente). Los datos se alojan en Supabase con acceso
            restringido por clínica (RLS).
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Qué datos se guardan</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Identificación del paciente (DNI, nombre, beneficio PAMI)</li>
            <li>Datos clínicos: consultas, diagnósticos, recetas, órdenes de estudio</li>
            <li>Datos de contacto para recordatorios de turno</li>
            <li>Registro de auditoría de acciones del equipo de salud</li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900">Responsable del tratamiento</h2>
          <p>
            El médico / consultorio titular de la cuenta es responsable frente al paciente.
            DrFlow actúa como encargado de procesamiento técnico durante el piloto.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Derechos del paciente</h2>
          <p>
            El paciente puede solicitar acceso, rectificación o supresión de sus datos al
            consultorio. Los registros clínicos emitidos se conservan según normativa vigente
            (mínimo 10 años para historias clínicas).
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Seguridad</h2>
          <p>
            Acceso con usuario y contraseña. Separación por clínica. Se recomienda HTTPS en
            producción, contraseñas fuertes y no compartir credenciales.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Contacto</h2>
          <p>Consultas sobre privacidad: contacto del consultorio médico titular de DrFlow.</p>
        </section>

        <div className="mt-10">
          <Link href="/login">
            <Button variant="outline">Volver al inicio de sesión</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
