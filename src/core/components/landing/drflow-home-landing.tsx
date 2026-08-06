import {
  ArrowRight,
  Brain,
  Calendar,
  ChevronDown,
  Globe,
  Lock,
  MessageCircle,
  Quote,
  Shield,
  Sparkles,
  Stethoscope,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";
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
import {
  MarketingAgendaMock,
  MarketingHcMock,
  MarketingHeroMock,
  MarketingRecetasMock,
} from "@/core/components/landing/marketing-ui-mocks";
import { PatientAppLandingSection } from "@/core/components/landing/patient-app-landing-section";
import { PlansPricingSection } from "@/core/components/landing/plans-pricing-section";
import { MarketingJsonLd } from "@/core/components/seo/marketing-json-ld";

import { buildWhatsAppUrl } from "@/shared/utils/whatsapp";

import { ButtonLink } from "@/components/ui/button";

const STATS = [
  { value: `${TRIAL_DAYS_INCLUDED} días`, label: "Prueba gratis", suffix: "" },
  { value: "3", label: "Planes", suffix: "desde $29.900" },
  { value: "PAMI", label: "Órdenes y recetas", suffix: "integradas" },
  { value: "24/7", label: "Soporte online", suffix: "soporte.opusorg.com.ar" },
] as const;

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
    badge: "Historia clínica inteligente",
    title: "Toda la información del paciente, al instante.",
    desc: "HC electrónica diseñada por médicos, para médicos. Antecedentes, evoluciones SOAP, órdenes PAMI y trazabilidad en una interfaz limpia.",
    bullets: [
      "Plantillas y evolución SOAP estructurada.",
      "Signos vitales, alergias y medicación activa.",
      "Export PDF con auditoría.",
    ],
    mock: MarketingHcMock,
    reverse: false,
  },
  {
    id: "agenda",
    badge: "Agenda automatizada",
    title: "Diga adiós a los turnos perdidos.",
    desc: "Gestione profesionales, consultorios y equipos con una agenda que conecta recepción y consultorio en tiempo real.",
    bullets: [
      "Reserva online con link público.",
      "Confirmar / ausente desde la vista día.",
      "Sala de espera para secretaría.",
    ],
    mock: MarketingAgendaMock,
    reverse: true,
  },
  {
    id: "recetas",
    badge: "Recetas digitales y PAMI",
    title: "Prescripciones y órdenes integradas.",
    desc: "Recetas Ley 25.649, vademécum, guía por síntomas y órdenes médicas PAMI en el mismo circuito clínico.",
    bullets: [
      "Compartir receta por WhatsApp o PDF.",
      "Farmacología por CIE-10 y síntomas.",
      "Órdenes médicas con vista previa e impresión.",
    ],
    mock: MarketingRecetasMock,
    reverse: false,
  },
] as const;

const AI_FEATURES = [
  { title: "Resumen automático", desc: "La IA lee el historial y genera un resumen conciso antes de que el paciente entre." },
  { title: "Generación SOAP", desc: "Dictá la consulta; la IA estructura la evolución para revisar y firmar." },
  { title: "Guía farmacológica", desc: "Búsqueda por patología o síntoma con vademécum integrado." },
  { title: "Sugerencia diagnóstica", desc: "Basado en síntomas y antecedentes, sugiere posibles diagnósticos (CIE-10)." },
] as const;

const SECURITY = [
  { icon: Lock, title: "Cifrado en tránsito", desc: "TLS 1.3 para todas las comunicaciones con la plataforma." },
  { icon: Globe, title: "Infraestructura", desc: "Supabase con backups automáticos y escalabilidad cloud." },
  { icon: Users, title: "Control de accesos", desc: "Roles médico, secretaría y admin con permisos por miembro." },
  { icon: Shield, title: "Cumplimiento", desc: "Arquitectura alineada a Ley 25.326 y buenas prácticas en salud." },
] as const;

const TESTIMONIALS = [
  {
    initials: "LF",
    quote:
      "Desde que implementamos DrFlow redujimos el tiempo administrativo. La interfaz es tan intuitiva que el equipo se adaptó en un día.",
    name: "Dra. Laura Fernández",
    role: "Directora Médica, Centro Médico Horizonte",
  },
  {
    initials: "ML",
    quote:
      "La integración de IA nos permite terminar las historias clínicas mucho más rápido. Es como tener un asistente sentado a mi lado.",
    name: "Dr. Martín López",
    role: "Traumatólogo, Consultorio Privado",
  },
  {
    initials: "SR",
    quote:
      "La agenda inteligente redujo casi por completo las ausencias. Los pacientes valoran los recordatorios por WhatsApp.",
    name: "Clínica San Rafael",
    role: "Gestión Administrativa",
  },
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
    a: `En soporte.opusorg.com.ar — tickets, guías y ayuda para usuarios activos.`,
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
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(45,212,191,0.22),transparent)]"
            aria-hidden
          />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 lg:grid-cols-2 lg:items-center lg:py-20">
            <div>
              <Suspense fallback={null}>
                <AccountDeletedCleanup />
              </Suspense>
              <div className="mb-6 flex items-center gap-4">
                <Image
                  src="/drflow-logo.png"
                  alt="DrFlow"
                  width={72}
                  height={72}
                  priority
                  className="h-16 w-16 rounded-2xl object-contain sm:h-[72px] sm:w-[72px]"
                />
                <p className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1 text-sm font-medium text-teal-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  PAMI · App paciente · Argentina
                </p>
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08]">
                Gestión clínica{" "}
                <span className="bg-gradient-to-r from-cyan-300 to-teal-400 bg-clip-text text-transparent">
                  sin saltos.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
                Agenda, historia clínica, recetas y seguimiento operativo para consultorios y clínicas.
                Diseñado para médico de cabecera y equipos multidisciplinarios.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/probar" size="lg">
                  Solicitar demo gratis
                </ButtonLink>
                <ButtonLink
                  href="/#funcionalidades"
                  size="lg"
                  variant="outline"
                  className="border-slate-600 bg-transparent text-white hover:bg-white/10"
                >
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

            <MarketingHeroMock />
          </div>

          <div className="flex justify-center pb-6">
            <a
              href="#stats"
              className="flex flex-col items-center gap-1 text-xs text-slate-500 transition-colors hover:text-teal-300"
              aria-label="Ver métricas"
            >
              <ChevronDown className="h-5 w-5 animate-bounce" />
            </a>
          </div>
        </section>

        {/* Stats */}
        <section id="stats" className="border-b border-slate-200 bg-white py-10">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <article key={stat.label} className="text-center">
                <p className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm font-semibold text-teal-700">{stat.label}</p>
                {stat.suffix ? (
                  <p className="mt-0.5 text-xs text-slate-500">{stat.suffix}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section id="beneficios" className="border-b border-slate-200 bg-slate-50 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Todo lo que necesita para operar con excelencia
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                DrFlow está construido sobre tecnologías modernas para una experiencia fluida, segura
                y escalable — enfocada en los pacientes.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map((b) => (
                <article
                  key={b.title}
                  className="rounded-2xl border border-white bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="inline-flex rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 p-2.5 text-white shadow-md shadow-teal-500/20">
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
        <section id="funcionalidades" className="bg-white py-20">
          <div className="mx-auto max-w-6xl space-y-24 px-4">
            {FEATURE_BLOCKS.map((block) => {
              const Mock = block.mock;
              return (
                <div
                  key={block.id}
                  className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${block.reverse ? "lg:[direction:rtl]" : ""}`}
                >
                  <div className={block.reverse ? "lg:[direction:ltr]" : undefined}>
                    <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
                      {block.badge}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                      {block.title}
                    </h2>
                    <p className="mt-3 leading-relaxed text-slate-600">{block.desc}</p>
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
                  <div className={block.reverse ? "lg:[direction:ltr]" : undefined}>
                    <Mock />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <PatientAppLandingSection />

        {/* AI */}
        <section id="ia" className="border-y border-slate-800 bg-slate-950 py-20 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">
                  DrFlow AI Cortex
                </p>
                <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
                  Su copiloto médico inteligente.
                </h2>
                <p className="mt-4 leading-relaxed text-slate-400">
                  La Inteligencia Artificial no reemplaza al médico; le otorga superpoderes.
                  Automatiza el trabajo administrativo pesado para enfocarse en el paciente.
                </p>
              </div>
              <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-xl shadow-teal-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
                  Análisis completado
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Paciente presenta leve mejoría. Se sugiere ajustar dosis y control en 15 días. La
                  decisión final siempre pertenece al profesional.
                </p>
              </div>
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
              * La decisión final y responsabilidad siempre pertenece al profesional médico. La IA es
              una herramienta de asistencia.
            </p>
          </div>
        </section>

        {/* Security */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
                Grado bancario
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                Privacidad y seguridad garantizadas por diseño
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                La información de sus pacientes es su activo más valioso. DrFlow cumple con las
                normativas más estrictas de protección de datos en salud.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SECURITY.map((s) => (
                <article
                  key={s.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition-shadow hover:shadow-md"
                >
                  <s.icon className="h-8 w-8 text-teal-600" />
                  <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-y border-slate-200 bg-slate-50 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Confiado por profesionales de la salud
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                Médicos y clínicas que modernizaron su gestión diaria con DrFlow.
              </p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <article
                  key={t.initials}
                  className="flex flex-col rounded-2xl border border-white bg-white p-6 shadow-sm"
                >
                  <Quote className="h-8 w-8 text-teal-500/40" />
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-6 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 text-sm font-bold text-white">
                      {t.initials}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-8 text-center text-xs text-slate-500">
              * Testimonios ilustrativos de casos de uso reales de la plataforma.
            </p>
          </div>
        </section>

        {/* Plans */}
        <section className="bg-white py-20">
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
              {" · "}
              Soporte:{" "}
              <a
                href={DRFLOW_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 hover:underline"
              >
                soporte.opusorg.com.ar
              </a>
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-slate-200 bg-slate-50 py-20">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-center text-3xl font-bold text-slate-900">Preguntas frecuentes</h2>
            <p className="mt-2 text-center text-slate-600">Todo lo que necesita saber sobre DrFlow.</p>
            <dl className="mt-10 space-y-4">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                Solicitar demo gratuita
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
