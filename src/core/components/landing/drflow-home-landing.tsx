import {
  ArrowRight,
  Brain,
  Calendar,
  ChevronDown,
  FileText,
  Globe,
  Lock,
  MessageCircle,
  Pill,
  Shield,
  Sparkles,
  Stethoscope,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import {
  DRFLOW_SUPPORT_URL,
  formatWhatsAppDisplay,
  getSalesContactEmail,
  getSalesWhatsAppPhone,
  TRIAL_DAYS_INCLUDED,
} from "@/core/billing/plans";
import { AccountDeletedCleanup } from "@/core/components/auth/account-deleted-cleanup";
import { MarketingFooter } from "@/core/components/landing/marketing-footer";
import { MarketingHeader } from "@/core/components/landing/marketing-header";
import { PatientAppLandingSection } from "@/core/components/landing/patient-app-landing-section";
import { PlansPricingSection } from "@/core/components/landing/plans-pricing-section";
import { MarketingJsonLd } from "@/core/components/seo/marketing-json-ld";

import { buildWhatsAppUrl } from "@/shared/utils/whatsapp";

import { ButtonLink } from "@/components/ui/button";

const BENEFITS = [
  {
    icon: Zap,
    title: "Rapidez extrema",
    desc: "Complete historias clínicas y emita recetas en segundos, sin fricción entre módulos.",
  },
  {
    icon: Brain,
    title: "IA integrada",
    desc: "Dictado por voz, resumen de consultas y asistencia clínica — la decisión final siempre es suya.",
  },
  {
    icon: Shield,
    title: "Seguridad por diseño",
    desc: "Roles granulares, RLS por clínica, cifrado en tránsito y auditoría de accesos.",
  },
  {
    icon: Calendar,
    title: "Agenda inteligente",
    desc: "Turnos web, confirmación, sala de espera y vista día con contexto del paciente.",
  },
] as const;

const FEATURE_BLOCKS = [
  {
    id: "hc",
    badge: "Historia clínica",
    title: "Toda la información del paciente, al instante.",
    desc: "HC electrónica diseñada para el flujo real del consultorio argentino: antecedentes, evoluciones SOAP, órdenes PAMI y trazabilidad.",
    bullets: [
      "Plantillas y evolución SOAP estructurada.",
      "Signos vitales, alergias y medicación activa.",
      "Export PDF con auditoría.",
    ],
    icon: FileText,
    accent: "from-cyan-500 to-teal-600",
    reverse: false,
  },
  {
    id: "agenda",
    badge: "Agenda automatizada",
    title: "Diga adiós a los turnos perdidos.",
    desc: "Gestione profesionales, consultorios y equipos con una agenda que conecta recepción y consultorio.",
    bullets: [
      "Reserva online con link público.",
      "Confirmar / ausente desde la vista día.",
      "Sala de espera para secretaría.",
    ],
    icon: Calendar,
    accent: "from-teal-500 to-emerald-600",
    reverse: true,
  },
  {
    id: "recetas",
    badge: "Recetas y PAMI",
    title: "Prescripciones y órdenes integradas.",
    desc: "Recetas Ley 25.649, vademécum, guía por síntomas y órdenes médicas PAMI en el mismo circuito.",
    bullets: [
      "Compartir receta por WhatsApp o PDF.",
      "Farmacología por CIE-10 y síntomas.",
      "Órdenes médicas con vista previa e impresión.",
    ],
    icon: Pill,
    accent: "from-violet-500 to-purple-600",
    reverse: false,
  },
] as const;

const AI_FEATURES = [
  { title: "Resumen automático", desc: "La IA lee el historial y genera un resumen antes de la consulta." },
  { title: "Generación SOAP", desc: "Dictá la consulta; la IA estructura la evolución para revisar y firmar." },
  { title: "Guía farmacológica", desc: "Búsqueda por patología o síntoma con vademécum integrado." },
  { title: "Asistente clínico", desc: "Sugerencias contextuales sin reemplazar su criterio profesional." },
] as const;

const SECURITY = [
  { icon: Lock, title: "Cifrado en tránsito", desc: "TLS 1.3 para todas las comunicaciones con la plataforma." },
  { icon: Globe, title: "Infraestructura", desc: "Supabase con backups automáticos y escalabilidad cloud." },
  { icon: Users, title: "Control de accesos", desc: "Roles médico, secretaría y admin con permisos por miembro." },
  { icon: Shield, title: "Cumplimiento", desc: "Arquitectura alineada a Ley 25.326 y buenas prácticas en salud." },
] as const;

const FAQ = [
  {
    q: "¿Puedo probar antes de contratar?",
    a: `Sí. ${TRIAL_DAYS_INCLUDED} días gratis en /probar, sin tarjeta. Tus datos se conservan si activás un plan.`,
  },
  {
    q: "¿Cómo activo un plan?",
    a: "Elegí un plan, escribinos por WhatsApp o email y te enviamos link de Mercado Pago. Checkout automático en la app: roadmap Fase 2.",
  },
  {
    q: "¿Incluye receta electrónica REFEPS?",
    a: "DrFlow emite recetas locales con disclaimer Ley 25.649. REFEPS nacional es roadmap separado.",
  },
  {
    q: "¿Dónde obtengo soporte técnico?",
    a: `En ${DRFLOW_SUPPORT_URL.replace("https://", "")} — tickets, guías y ayuda para usuarios activos.`,
  },
] as const;

export function DrFlowHomeLanding() {
  const salesEmail = getSalesContactEmail();
  const phone = getSalesWhatsAppPhone();
  const salesWhatsAppHref =
    phone && buildWhatsAppUrl(phone, "Hola, quiero conocer DrFlow para mi consultorio.")
      ? buildWhatsAppUrl(phone, "Hola, quiero conocer DrFlow para mi consultorio.")
      : null;

  return (
    <div className="min-h-screen drflow-marketing drflow-marketing-site">
      <MarketingJsonLd />
      <MarketingHeader variant="dark" />

      <main id="main-content">
        {/* Hero */}
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(45,212,191,0.18),transparent)]"
            aria-hidden
          />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <Suspense fallback={null}>
                <AccountDeletedCleanup />
              </Suspense>
              <p className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1 text-sm font-medium text-teal-200">
                <Sparkles className="h-3.5 w-3.5" />
                Consultorios argentinos · PAMI · App paciente
              </p>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-tight">
                Gestión clínica{" "}
                <span className="bg-gradient-to-r from-cyan-300 to-teal-400 bg-clip-text text-transparent">
                  sin saltos.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
                Agenda, historia clínica, recetas y seguimiento operativo para consultorios y clínicas.
                De turno a receta en un solo flujo.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/probar" size="lg">
                  Probar {TRIAL_DAYS_INCLUDED} días gratis
                </ButtonLink>
                <ButtonLink href="/#funcionalidades" size="lg" variant="outline" className="border-slate-600 bg-transparent text-white hover:bg-white/10">
                  Ver cómo funciona
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>
              <p className="mt-6 text-sm text-slate-400">
                ¿Ya tenés cuenta?{" "}
                <Link href="/login" className="text-teal-300 hover:underline">
                  Iniciar sesión
                </Link>
              </p>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-teal-500/10 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-teal-300">
                  <Sparkles className="h-4 w-4" />
                  Asistente clínico
                </div>
                <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                  Resumen generado automáticamente
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Paciente con HTA controlada. Última receta hace 28 días. Sugerir control de
                  presión y renovación si corresponde. La decisión final siempre pertenece al
                  profesional.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: "Consultas", value: "HC + SOAP" },
                    { label: "Recetas", value: "Ley 25.649" },
                    { label: "Agenda", value: "Turnos web" },
                    { label: "PAMI", value: "Órdenes" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-white/5 bg-slate-800/60 px-3 py-2"
                    >
                      <p className="text-xs text-slate-500">{stat.label}</p>
                      <p className="text-sm font-semibold text-teal-200">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pb-8">
            <a
              href="#beneficios"
              className="flex flex-col items-center gap-1 text-xs text-slate-500 transition-colors hover:text-teal-300"
              aria-label="Ir a beneficios"
            >
              <ChevronDown className="h-5 w-5 animate-bounce" />
            </a>
          </div>
        </section>

        {/* Benefits */}
        <section id="beneficios" className="border-b border-slate-200 bg-white py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Todo lo que necesita para operar con excelencia
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                DrFlow está construido para que su equipo se enfoque en lo más importante: los
                pacientes.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map((b) => (
                <article
                  key={b.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition-shadow hover:shadow-md"
                >
                  <div className="inline-flex rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 p-2.5 text-white shadow-sm">
                    <b.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-900">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Feature blocks */}
        <section id="funcionalidades" className="py-20">
          <div className="mx-auto max-w-6xl space-y-24 px-4">
            {FEATURE_BLOCKS.map((block) => (
              <div
                key={block.id}
                className={`grid items-center gap-10 lg:grid-cols-2 ${block.reverse ? "lg:[direction:rtl]" : ""}`}
              >
                <div className={block.reverse ? "lg:[direction:ltr]" : undefined}>
                  <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
                    {block.badge}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{block.title}</h2>
                  <p className="mt-3 text-slate-600">{block.desc}</p>
                  <ul className="mt-5 space-y-2">
                    {block.bullets.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                        <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <ButtonLink href="/probar" variant="outline" className="mt-6">
                    Conocer más
                  </ButtonLink>
                </div>
                <div
                  className={`rounded-2xl bg-gradient-to-br ${block.accent} p-8 text-white shadow-xl ${block.reverse ? "lg:[direction:ltr]" : ""}`}
                >
                  <block.icon className="h-12 w-12 opacity-90" />
                  <p className="mt-6 text-lg font-medium opacity-95">
                    Interfaz {block.badge.toLowerCase()} — rápida, clara y pensada para el consultorio.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <PatientAppLandingSection />

        {/* AI */}
        <section id="ia" className="border-y border-slate-200 bg-slate-950 py-20 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">
                DrFlow AI
              </p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Su copiloto médico inteligente.</h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-400">
                La IA no reemplaza al médico; automatiza lo administrativo pesado para que usted se
                enfoque en el paciente.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {AI_FEATURES.map((f) => (
                <article
                  key={f.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
                >
                  <h3 className="font-semibold text-teal-200">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 text-center text-xs text-slate-500">
              * La decisión final y responsabilidad siempre pertenece al profesional médico.
            </p>
          </div>
        </section>

        {/* Security */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
                Grado profesional
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                Privacidad y seguridad garantizadas por diseño
              </h2>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SECURITY.map((s) => (
                <article key={s.title} className="rounded-2xl border border-slate-200 p-6">
                  <s.icon className="h-8 w-8 text-teal-600" />
                  <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Plans */}
        <section className="bg-gradient-to-b from-slate-50 to-white py-20">
          <div className="mx-auto max-w-6xl px-4">
            <PlansPricingSection />
            <p className="mt-8 text-center text-sm text-slate-500">
              Consultas comerciales:{" "}
              <a href={`mailto:${salesEmail}`} className="text-teal-700 hover:underline">
                {salesEmail}
              </a>
              {phone ? (
                <>
                  {" · "}
                  <a
                    href={salesWhatsAppHref ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-700 hover:underline"
                  >
                    WhatsApp {formatWhatsAppDisplay(phone)}
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-slate-200 bg-white py-20">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-center text-3xl font-bold text-slate-900">Preguntas frecuentes</h2>
            <p className="mt-2 text-center text-slate-600">Todo lo que necesita saber sobre DrFlow.</p>
            <dl className="mt-10 space-y-4">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                  <dt className="font-semibold text-slate-900">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-950 py-20 text-white">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">
              ¿Listo para llevar su consultorio al siguiente nivel?
            </h2>
            <p className="mt-4 text-slate-400">
              Modernice su práctica, reduzca ausencias y recupere tiempo con DrFlow.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/probar" size="lg">
                Probar {TRIAL_DAYS_INCLUDED} días gratis
              </ButtonLink>
              {salesWhatsAppHref ? (
                <a
                  href={salesWhatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="drflow-ui-button inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-transparent px-6 py-3 text-base font-medium text-white transition-colors hover:bg-white/10"
                >
                  <MessageCircle className="h-5 w-5" />
                  Hablar con ventas
                </a>
              ) : null}
              <a
                href={DRFLOW_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="drflow-ui-button inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-medium text-teal-300 transition-colors hover:text-teal-200"
              >
                Centro de soporte
              </a>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
