"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PublicBookingForm } from "@/core/components/booking/public-booking-form";

import { usePatientPortal } from "@/features/pacientes/hooks/use-patient-portal";
import { PatientPortalBottomNav } from "@/features/portal/components/portal/patient-portal-bottom-nav";
import { PatientPortalHeader } from "@/features/portal/components/portal/patient-portal-header";
import { PatientPortalHomeScreen } from "@/features/portal/components/portal/patient-portal-home-screen";
import { PatientPortalRecetaScreen } from "@/features/portal/components/portal/patient-portal-receta-screen";
import { PatientPortalWhatsappScreen } from "@/features/portal/components/portal/patient-portal-whatsapp-screen";
import { PatientRequestsPanel } from "@/features/portal/components/portal/patient-requests-panel";
import { readDemoBookingLink } from "@/features/portal/utils/demo-booking-link";

import { restoreDemoPortalBooking } from "@/lib/actions/public-booking";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";

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
  offersPami?: boolean;
  portalError?: boolean;
  demoBooking?: boolean;
  startOnBooking?: boolean;
  pushPublicKey?: string;
}

/** App pacientes estilo Crontu: inicio con accesos grandes + navegación inferior. */
export function PatientPortalView({
  slug,
  clinicName,
  clinicPhone,
  clinicAddress,
  professionals,
  doctor,
  offersPami = false,
  portalError = false,
  demoBooking = false,
  startOnBooking = false,
  pushPublicKey,
}: Props) {
  const portal = usePatientPortal({ slug, clinicName, doctor, offersPami, initialScreen: startOnBooking ? "turno" : "inicio" });
  const { setScreen } = portal;
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!demoBooking) return;
    const receipt = readDemoBookingLink(window.location.hash);
    if (!receipt) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    restoreDemoPortalBooking(slug, receipt)
      .then((result) => {
        if (result.error) setLinkError(result.error);
        else setScreen("turnos");
      })
      .catch(() => setLinkError("No pudimos abrir el enlace de seguimiento."));
  }, [demoBooking, setScreen, slug]);

  return (
    <div className={demoBooking ? "flex min-h-dvh flex-col bg-slate-100 pb-20" : "flex min-h-screen flex-col bg-slate-100 pb-20"}>
      <PatientPortalHeader doctorName={portal.doctorName} doctor={doctor} />

      <main className={demoBooking ? "mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-4" : "mx-auto w-full max-w-lg flex-1 px-4 pt-4"}>
        {portalError || linkError ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {linkError ?? "El enlace de acceso no es válido o venció."}
          </p>
        ) : null}

        {portal.screen === "inicio" && (
          <PatientPortalHomeScreen
            slug={slug}
            clinicName={clinicName}
            clinicAddress={clinicAddress}
            clinicPhone={clinicPhone}
            portalReady={portal.portalReady}
            setPortalReady={portal.setPortalReady}
            quickActions={demoBooking ? portal.quickActions.filter((action) => action.id !== "whatsapp") : portal.quickActions}
            demoBooking={demoBooking}
            setScreen={portal.setScreen}
            refreshTrigger={portal.requestsVersion}
            pushPublicKey={pushPublicKey}
          />
        )}

        {portal.screen === "turno" &&
          (professionals.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {demoBooking ? "Por ahora no hay profesionales disponibles para pedir turno." : "Turnos online no disponibles. Usá WhatsApp para contactar al consultorio."}
            </p>
          ) : (
            <PublicBookingForm
              slug={slug}
              clinicName={clinicName}
              professionals={professionals}
              onRequestSaved={portal.bumpRequestsVersion}
              demoBooking={demoBooking}
              onViewRequests={() => setScreen("turnos")}
            />
          ))}

        {portal.screen === "receta" && (demoBooking ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            La solicitud de recetas no está habilitada en esta demo.
          </p>
        ) : (
          <PatientPortalRecetaScreen
            offersPami={offersPami}
            clinicPhone={clinicPhone}
            patientName={portal.patientName}
            setPatientName={portal.setPatientName}
            documentNumber={portal.documentNumber}
            setDocumentNumber={portal.setDocumentNumber}
            insuranceNumber={portal.insuranceNumber}
            setInsuranceNumber={portal.setInsuranceNumber}
            medications={portal.medications}
            setMedications={portal.setMedications}
            recetaMessage={portal.recetaMessage}
            logWhatsappRequest={portal.logWhatsappRequest}
          />
        ))}

        {!demoBooking && portal.screen === "whatsapp" && (
          <PatientPortalWhatsappScreen
            clinicName={clinicName}
            clinicPhone={clinicPhone}
            doctorName={portal.doctorName}
            logWhatsappRequest={portal.logWhatsappRequest}
          />
        )}

        {portal.screen === "turnos" && (
          <PatientRequestsPanel
            slug={slug}
            clinicName={clinicName}
            refreshTrigger={portal.requestsVersion}
            demoBooking={demoBooking}
          />
        )}
      </main>

      <footer className={`mx-auto max-w-lg px-4 pt-6 text-center text-[11px] text-slate-500 ${demoBooking ? "pb-3" : "pb-24"}`}>
        <Link href={`/aviso-paciente?clinic=${encodeURIComponent(slug)}`} className="underline">
          Información al paciente
        </Link>
        {" · "}
        <Link href="/privacidad" className="underline">
          Privacidad
        </Link>
      </footer>

      <PatientPortalBottomNav screen={portal.screen} onNavigate={portal.setScreen} />
    </div>
  );
}
