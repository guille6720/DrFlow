import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DrFlowLogo } from "@/core/components/brand/drflow-logo";
import {
  Activity,
  Calendar,
  ClipboardList,
  Globe,
  Smartphone,
  Stethoscope,
  Users,
} from "lucide-react";

const PRODUCTION_URL = "https://drflow-app-rho.vercel.app";

const STEPS = [
  {
    n: 1,
    title: "Creá tu consultorio de prueba",
    body: "Registrate con email y contraseña. Cada médico tiene su propio espacio aislado — no se mezclan los datos.",
    href: "/register",
    cta: "Registrarse gratis",
  },
  {
    n: 2,
    title: "Cargá datos de ejemplo",
    body: "En Configuración → Cargar pacientes demo. Vas a ver agenda, pacientes, historias y turnos de hoy sin cargar nada a mano.",
    href: "/configuracion?grupo=sistema&seccion=demo",
    cta: "Ir a Configuración",
    afterLogin: true,
  },
  {
    n: 3,
    title: "Probá los módulos clave",
    body: "Recorré agenda, pacientes, historia clínica, recetas, guía PAMI, farmacología por síntomas y registro de atenciones.",
    afterLogin: true,
  },
  {
    n: 4,
    title: "Compartí la app al paciente",
    body: "Desde la ficha del paciente → App para el paciente. El paciente puede ver turnos, cancelar y agendar desde el celular.",
    afterLogin: true,
  },
];

const MODULES = [
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: Users, label: "Pacientes", path: "/pacientes" },
  { icon: Stethoscope, label: "Historias", path: "/historias" },
  { icon: ClipboardList, label: "Atenciones", path: "/atenciones" },
  { icon: Activity, label: "Farmacología", path: "/herramientas/farmacologia" },
  { icon: Globe, label: "Turnos online", path: "/solicitar-turno" },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen drflow-marketing">
      <header className="border-b border-blue-100/80 bg-white/85 backdrop-blur-md">
        <div className="relative mx-auto flex max-w-4xl items-center justify-between px-4 py-5">
          <DrFlowLogo size="md" href="/" />
          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Ingresar
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Probar gratis</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="text-center">
          <p className="text-sm font-medium text-blue-700">Prueba sin instalar nada</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Probá DrFlow en 5 minutos
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Consultorio digital para médicos argentinos: agenda, historia clínica, PAMI, recetas y
            app para el paciente.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={PRODUCTION_URL + "/register"}>
              <Button size="lg">Empezar en producción</Button>
            </a>
            <Link href="/register">
              <Button size="lg" variant="outline">
                Empezar en local
              </Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Link para compartir:{" "}
            <a
              href={PRODUCTION_URL + "/demo"}
              className="font-mono text-blue-700 hover:underline"
            >
              {PRODUCTION_URL}/demo
            </a>
          </p>
        </div>

        <ol className="mt-14 space-y-6">
          {STEPS.map((step) => (
            <li key={step.n}>
              <Card className="border-blue-100/80">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                    {step.n}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-slate-900">{step.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
                    {step.href && !step.afterLogin && (
                      <Link href={step.href} className="mt-3 inline-block">
                        <Button size="sm">{step.cta}</Button>
                      </Link>
                    )}
                    {step.afterLogin && step.href && (
                      <p className="mt-2 text-xs text-slate-500">
                        Disponible después de iniciar sesión →{" "}
                        <Link href={step.href} className="text-blue-700 hover:underline">
                          {step.cta}
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>

        <section className="mt-14">
          <h2 className="text-center text-xl font-bold text-slate-900">Qué probar</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((mod) => (
              <div
                key={mod.label}
                className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm"
              >
                <mod.icon className="h-5 w-5 shrink-0 text-blue-600" />
                <span className="font-medium text-slate-800">{mod.label}</span>
              </div>
            ))}
          </div>
        </section>

        <Card className="mt-14 border-emerald-200 bg-emerald-50/50" title="Mensaje para WhatsApp">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {`Hola, te comparto DrFlow para que pruebes el consultorio digital.

1. Entrá a ${PRODUCTION_URL}/demo
2. Registrate con tu email
3. En Configuración → Cargar pacientes demo
4. Probá agenda, pacientes, historias y app paciente

Cualquier duda, avisame.`}
          </p>
        </Card>

        <section className="mt-14 rounded-2xl border border-slate-200 bg-white/70 p-6">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Smartphone className="h-5 w-5 text-blue-600" />
            App paciente (PWA)
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Después de cargar demo, abrí la ficha de un paciente y tocá{" "}
            <strong>App para el paciente</strong>. Podés enviar el link por WhatsApp. Es una PWA
            verde, separada de la app azul del consultorio.
          </p>
        </section>
      </main>

      <footer className="border-t border-blue-100 py-8 text-center text-sm text-slate-500">
        <Link href="/" className="text-blue-700 hover:underline">
          ← Volver al inicio
        </Link>
      </footer>
    </div>
  );
}
