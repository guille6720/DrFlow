import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { DrFlowLogo } from "@/core/components/brand/drflow-logo";
import {
  Calendar,
  ClipboardPlus,
  Pill,
  Smartphone,
  Stethoscope,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Probar DrFlow 10 días gratis | Consultorio",
  description:
    "Probá DrFlow gratis durante 10 días: agenda, historia clínica, recetas, PAMI y app para pacientes.",
  openGraph: {
    title: "Probar DrFlow 10 días gratis",
    description:
      "Software para consultorios argentinos. Agenda, HC, recetas y app del paciente.",
    url: "https://drflow.opusorg.com/probar",
    siteName: "DrFlow",
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DrFlow",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Probar DrFlow 10 días gratis",
    description: "Agenda, HC, recetas y app del paciente — 10 días gratis.",
    images: ["/og-image.png"],
  },
};

const BENEFITS = [
  { icon: Calendar, text: "Agenda del día y turnos online" },
  { icon: Stethoscope, text: "Historia clínica con timer de consulta" },
  { icon: Pill, text: "Recetas, farmacología y guía PAMI" },
  { icon: Smartphone, text: "App para que el paciente pida turno" },
  { icon: ClipboardPlus, text: "Registro de atenciones por cobertura" },
];

export default function ProbarPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50">
      <header className="border-b border-blue-100 bg-white/90 px-4 py-4">
        <div className="mx-auto flex max-w-3xl justify-center">
          <DrFlowLogo size="lg" href="/" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <p className="text-center text-sm font-semibold uppercase tracking-wide text-blue-700">
          Invitación · Prueba 10 días
        </p>
        <h1 className="mt-3 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Probá DrFlow en tu consultorio,{" "}
          <span className="text-blue-700">gratis por 10 días</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-slate-600 sm:text-lg">
          Agenda, historia clínica, recetas y app para pacientes — pensado para médicos
          en Argentina (PAMI y obras sociales). Sin tarjeta para empezar.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/register?trial=10&utm_source=whatsapp&utm_medium=invite">
            <Button size="lg" className="w-full min-w-[240px] sm:w-auto">
              Crear mi consultorio gratis
            </Button>
          </Link>
          <Link href="/demo?utm_source=whatsapp">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Ver cómo funciona
            </Button>
          </Link>
        </div>

        <ul className="mt-10 space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {BENEFITS.map((b) => (
            <li key={b.text} className="flex items-start gap-3 text-sm text-slate-800">
              <b.icon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              {b.text}
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-950">
          <p className="flex items-start gap-2 font-medium">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Cómo empezar en 3 pasos
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Registrate y creá tu consultorio.</li>
            <li>En Configuración → cargá pacientes demo (opcional).</li>
            <li>Probá agenda → consulta → receta durante 10 días.</li>
          </ol>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-blue-700 hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </main>
    </div>
  );
}
