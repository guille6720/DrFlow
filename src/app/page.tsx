import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Calendar,
  Shield,
  Users,
  FileText,
  Pill,
  Stethoscope,
  Sparkles,
} from "lucide-react";

const differentiators = [
  {
    icon: Pill,
    title: "Guía por síntomas",
    desc: "Buscá patología por CIE-10 o por lo que cuenta el paciente — algo que DrApp y Turnito no ofrecen así.",
    accent: "from-violet-500 to-purple-600",
  },
  {
    icon: Stethoscope,
    title: "Flujo consulta → receta",
    desc: "Timer de consulta, historia clínica, receta Ley 25.649 y compartir por WhatsApp en un solo circuito.",
    accent: "from-teal-500 to-teal-700",
  },
  {
    icon: Calendar,
    title: "Agenda con contexto",
    desc: "Vista día con Empezar consulta, badge de turnos web y acciones confirmar/ausente.",
    accent: "from-cyan-500 to-teal-600",
  },
  {
    icon: Shield,
    title: "Multi-clínica segura",
    desc: "Roles granulares, RLS por clínica y auditoría — preparado para consultorios compartidos.",
    accent: "from-slate-600 to-slate-800",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen drflow-mesh">
      <header className="border-b border-teal-100/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-teal-900">
            <div className="rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 p-2 text-white shadow-md shadow-teal-600/25">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">DrFlow</span>
          </div>
          <div className="flex gap-3">
            <Link href="/login">
              <Button variant="ghost">Ingresar</Button>
            </Link>
            <Link href="/register">
              <Button>Registrar consultorio</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1 text-sm font-medium text-teal-800">
          <Sparkles className="h-3.5 w-3.5" />
          Hecho para médicos argentinos
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Tu consultorio fluye.
          <span className="mt-2 block bg-gradient-to-r from-teal-600 to-teal-800 bg-clip-text text-transparent">
            De turno a receta sin saltos.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          DrFlow une agenda, historia clínica, recetas y farmacología por síntomas — sin la
          complejidad de un ERP médico ni la limitación de una turnera simple.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/register">
            <Button size="lg">Probar gratis</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Ya tengo cuenta
            </Button>
          </Link>
        </div>
      </section>

      <section className="border-y border-teal-100/80 bg-white/60 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Por qué DrFlow no es otra turnera más
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
            Comparado con DrApp, Turnito o Gendu: más clínico. Comparado con MedicAI: más simple
            para arrancar.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {differentiators.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-teal-100/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className={`inline-flex rounded-xl bg-gradient-to-br ${f.accent} p-2.5 text-white shadow-sm`}
                >
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-3">
          {[
            { icon: Users, title: "Pacientes", desc: "Ficha con alergias, medicación y obra social." },
            { icon: FileText, title: "Historia clínica", desc: "PDF, auditoría y trazabilidad." },
            { icon: Activity, title: "Reserva online", desc: "Link público para que reserven turno." },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <f.icon className="mx-auto h-8 w-8 text-teal-600" />
              <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-teal-100 py-8 text-center text-sm text-slate-500">
        DrFlow — Gestión clínica con identidad propia. Argentina.
      </footer>
    </div>
  );
}
