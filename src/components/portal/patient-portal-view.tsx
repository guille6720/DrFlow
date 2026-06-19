"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicBookingForm } from "@/components/booking/public-booking-form";
import { PatientRequestsPanel } from "@/components/portal/patient-requests-panel";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildPrescriptionRequestMessage } from "@/lib/utils/patient-messages";
import { PatientAppIcon } from "@/components/brand/patient-app-icon";
import { AppInstallCard } from "@/components/portal/app-install-card";
import { isPatientPortalReady } from "@/lib/utils/patient-portal-ready";
import {
  addPatientRequest,
  getStoredDocument,
} from "@/lib/utils/patient-requests-storage";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";
import { cn } from "@/lib/utils/cn";
import {
  Bell,
  Calendar,
  Home,
  MessageCircle,
  Pill,
  Smartphone,
} from "lucide-react";

type Screen = "inicio" | "turno" | "receta" | "turnos" | "whatsapp";

interface Professional {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  bio?: string | null;
  specialties?: { name: string } | { name: string }[] | null;
}

interface Props {
  slug: string;
  clinicName: string;
  clinicPhone: string | null;
  clinicAddress: string | null;
  professionals: Professional[];
  doctor?: DoctorShareInfo | null;
}

const NAV: { id: Screen; label: string; icon: typeof Home }[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "turno", label: "Turno", icon: Calendar },
  { id: "turnos", label: "Mis turnos", icon: Bell },
  { id: "receta", label: "Receta", icon: Pill },
];

/** App pacientes estilo Crontu/DrApp: inicio con accesos grandes + navegación inferior. */
export function PatientPortalView({
  slug,
  clinicName,
  clinicPhone,
  clinicAddress,
  professionals,
  doctor,
}: Props) {
  const [screen, setScreen] = useState<Screen>("inicio");
  const [portalReady, setPortalReady] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [medications, setMedications] = useState("");
  const [requestsVersion, setRequestsVersion] = useState(0);

  useEffect(() => {
    queueMicrotask(() => {
      setPortalReady(isPatientPortalReady(slug));
      setDocumentNumber(getStoredDocument(slug));
    });
  }, [slug]);

  function logWhatsappRequest(type: "turno" | "receta" | "consulta") {
    addPatientRequest(slug, {
      type,
      channel: "whatsapp",
      documentNumber: documentNumber.trim() || getStoredDocument(slug) || "—",
      patientName: patientName.trim() || "Paciente",
    });
    setRequestsVersion((v) => v + 1);
  }

  const recetaMessage = buildPrescriptionRequestMessage({
    patientName: patientName || "Paciente",
    documentNumber: documentNumber || "________",
    medications: medications || "________________",
    insuranceNumber: insuranceNumber || undefined,
  });

  const doctorName = doctor?.fullName ?? clinicName;

  const quickActions = [
    {
      id: "turno" as Screen,
      title: "Pedir turno",
      desc: "Elegí día y horario",
      icon: Calendar,
      color: "from-emerald-500 to-emerald-700",
    },
    {
      id: "turnos" as Screen,
      title: "Mis turnos",
      desc: "Ver o cancelar",
      icon: Bell,
      color: "from-blue-500 to-blue-700",
    },
    {
      id: "receta" as Screen,
      title: "Receta PAMI",
      desc: "Renovar medicación",
      icon: Pill,
      color: "from-violet-500 to-violet-700",
    },
    {
      id: "whatsapp" as Screen,
      title: "WhatsApp",
      desc: "Hablar con el médico",
      icon: MessageCircle,
      color: "from-[#128C7E] to-[#075E54]",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 pb-20">
      {/* Header médico */}
      <header className="bg-gradient-to-br from-emerald-600 to-emerald-800 px-4 pb-6 pt-5 text-white shadow-md">
        <div className="mx-auto flex max-w-lg items-center gap-4">
          <PatientAppIcon size="sm" className="shrink-0 shadow-md" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-emerald-200">DrFlow · Pacientes</p>
            <h1 className="truncate text-lg font-bold">{doctorName}</h1>
            {doctor?.specialty && (
              <p className="truncate text-sm text-emerald-100">{doctor.specialty}</p>
            )}
            {doctor?.licenseLabel && (
              <p className="text-xs text-emerald-200/90">{doctor.licenseLabel}</p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">
        {!portalReady && (
          <>
            <AppInstallCard
              slug={slug}
              clinicName={clinicName}
              portalMode
              className="mb-4"
              onPortalReady={() => setPortalReady(true)}
            />
            <Link
              href={`/portal/${slug}/instalar`}
              className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-800"
            >
              <Smartphone className="h-4 w-4" />
              Ver guía para instalar la app
            </Link>
          </>
        )}

        {screen === "inicio" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => setScreen(action.id)}
                    className={cn(
                      "flex flex-col items-start rounded-2xl bg-gradient-to-br p-4 text-left text-white shadow-md transition active:scale-[0.98]",
                      action.color
                    )}
                  >
                    <Icon className="mb-3 h-8 w-8 opacity-90" />
                    <span className="text-base font-bold leading-tight">{action.title}</span>
                    <span className="mt-1 text-xs opacity-90">{action.desc}</span>
                  </button>
                );
              })}
            </div>

            {clinicAddress && (
              <p className="text-center text-xs text-slate-500">{clinicAddress}</p>
            )}

            {clinicPhone && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-sm text-slate-600">Teléfono del consultorio</p>
                <p className="mt-1 font-semibold text-slate-900">{clinicPhone}</p>
              </div>
            )}
          </div>
        )}

        {screen === "turno" && (
          <div>
            {professionals.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Turnos online no disponibles. Usá WhatsApp para contactar al consultorio.
              </p>
            ) : (
              <PublicBookingForm
                slug={slug}
                clinicName={clinicName}
                professionals={professionals}
                onRequestSaved={() => setRequestsVersion((v) => v + 1)}
              />
            )}
          </div>
        )}

        {screen === "receta" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">
              Completá tus datos y enviá la solicitud de receta PAMI por WhatsApp.
            </p>
            <Input
              label="Nombre y apellido"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              required
            />
            <Input
              label="DNI"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              required
            />
            <Input
              label="N° afiliado PAMI (opcional)"
              value={insuranceNumber}
              onChange={(e) => setInsuranceNumber(e.target.value)}
            />
            <Textarea
              label="Medicación a renovar"
              rows={4}
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              placeholder="Ej: Enalapril 10 mg, Metformina 850 mg..."
              required
            />
            <PatientWhatsAppButton
              phone={clinicPhone}
              message={recetaMessage}
              label="Enviar solicitud por WhatsApp"
              size="md"
              className="w-full"
              onOpen={() => logWhatsappRequest("receta")}
            />
          </div>
        )}

        {screen === "whatsapp" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <MessageCircle className="mx-auto h-14 w-14 text-[#25D366]" />
            <p className="text-sm text-slate-600">
              Escribile a {doctorName} por WhatsApp para turnos, recetas o consultas.
            </p>
            <PatientWhatsAppButton
              phone={clinicPhone}
              message={`Hola Dr/a. ${doctorName.split(" ").slice(-1)[0] ?? ""}, soy paciente. Quisiera pedir un turno.`}
              label="Pedir turno por WhatsApp"
              size="md"
              className="mx-auto w-full max-w-xs"
              onOpen={() => logWhatsappRequest("turno")}
            />
            <PatientWhatsAppButton
              phone={clinicPhone}
              message={`Hola, soy paciente de ${clinicName}. Tengo una consulta.`}
              label="Consulta general"
              size="md"
              className="mx-auto w-full max-w-xs"
              onOpen={() => logWhatsappRequest("consulta")}
            />
            {!clinicPhone && (
              <p className="text-xs text-amber-700">
                El consultorio no tiene teléfono cargado.
              </p>
            )}
          </div>
        )}

        {screen === "turnos" && (
          <PatientRequestsPanel
            slug={slug}
            clinicName={clinicName}
            refreshTrigger={requestsVersion}
          />
        )}
      </main>

      {/* Navegación inferior fija (estilo app nativa) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-lg justify-around">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.id === "inicio" ? screen === "inicio" : screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setScreen(item.id === "inicio" ? "inicio" : item.id)}
                className={cn(
                  "flex min-w-[4rem] flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition sm:text-xs",
                  isActive ? "text-emerald-700" : "text-slate-500"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-emerald-600")} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
