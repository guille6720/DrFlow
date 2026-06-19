import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import {
  Calendar,
  Users,
  Stethoscope,
  Pill,
  MessageCircle,
  ScrollText,
  ClipboardList,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const dailyFlow = [
  {
    step: "1",
    title: "Agenda del día",
    desc: "Vista día → confirmá turnos → Empezar consulta.",
    href: "/agenda?view=day",
    icon: Calendar,
  },
  {
    step: "2",
    title: "Consulta PAMI",
    desc: "Usá plantilla HTA / DM2 / renovación. Revisá alergias arriba.",
    href: "/historias/nueva",
    icon: Stethoscope,
  },
  {
    step: "3",
    title: "Planillas PAMI",
    desc: "Internación domiciliaria, geriátrico, insumos, oxígeno.",
    href: "/pami/planillas",
    icon: ClipboardList,
  },
  {
    step: "4",
    title: "Estudios o derivación",
    desc: "Chips rápidos: laboratorio, ECG, cardiólogo, kinesio.",
    href: "/historias",
    icon: ScrollText,
  },
  {
    step: "5",
    title: "Receta + WhatsApp",
    desc: "Receta PDF Ley 25.649. Compartir al familiar del paciente.",
    href: "/recetas",
    icon: Pill,
  },
];

const checklist = [
  "Activar perfil PAMI en Configuración (plantillas + turnos 20 min)",
  "Cargar pacientes demo o fichas reales con N° beneficio PAMI",
  "Completar alergias y medicación habitual en cada ficha",
  "Probar recordatorio WhatsApp desde Recordatorios",
  "Revisar checklist QA en /qa antes del primer día real",
];

export default async function GuiaPamiPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, clinic } = await getActiveClinic();
  const isPamiProfile = clinic?.practice_profile === "cabecera_pami";

  return (
    <>
      <Header
        title="Guía — médico de cabecera PAMI"
        subtitle="Flujo diario recomendado para consultorio geriátrico"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="space-y-6 p-4 sm:p-6">
        {!isPamiProfile && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Todavía no activaste el perfil PAMI. Andá a{" "}
            <Link href="/configuracion" className="font-medium underline">
              Configuración
            </Link>{" "}
            y pulsá <strong>Activar consultorio PAMI cabecera</strong>.
          </div>
        )}

        <Card title="Tu día en 4 pasos">
          <div className="grid gap-4 sm:grid-cols-2">
            {dailyFlow.map((item) => (
              <Link
                key={item.step}
                href={item.href}
                className="group flex gap-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4 transition-all hover:border-blue-200 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {item.step}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-blue-700" />
                    <p className="font-semibold text-slate-900">{item.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Qué trae DrFlow vs otras apps">
            <ul className="space-y-3 text-sm text-slate-700">
              <li>
                <strong>DrApp / Turnito:</strong> agenda y recordatorios — DrFlow suma plantillas
                clínicas PAMI, estudios/derivaciones en 1 clic y guía por síntomas.
              </li>
              <li>
                <strong>MedicAI:</strong> facturación OS/ARCA — DrFlow es más liviano para
                cabecera solo PAMI (sin liquidaciones por ahora).
              </li>
              <li>
                <strong>WhatsApp:</strong> abre con mensaje listo (sin API) — ideal para
                secretaría o médico con pocos minutos.
              </li>
            </ul>
          </Card>

          <Card title="Checklist antes del piloto">
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/configuracion">
                <Button size="sm">Configuración</Button>
              </Link>
              <Link href="/qa">
                <Button size="sm" variant="outline">
                  Checklist QA
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        <Card title="Datos que el paciente PAMI debe traer">
          <div className="grid gap-4 sm:grid-cols-3 text-sm text-slate-600">
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 text-blue-600" />
              DNI + credencial PAMI vigente
            </div>
            <div className="flex items-start gap-2">
              <Pill className="mt-0.5 h-4 w-4 text-blue-600" />
              Medicación actual (cajas o listado)
            </div>
            <div className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 h-4 w-4 text-blue-600" />
              Teléfono del familiar / cuidador
            </div>
          </div>
          <Link
            href="/pacientes/nuevo"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
          >
            Alta de paciente PAMI <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    </>
  );
}
