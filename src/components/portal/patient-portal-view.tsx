"use client";

import Link from "next/link";
import { PublicBookingForm } from "@/components/booking/public-booking-form";
import { PatientRequestsPanel } from "@/components/portal/patient-requests-panel";
import { PatientPortalHeader } from "@/components/portal/patient-portal-header";
import { PatientPortalHomeScreen } from "@/components/portal/patient-portal-home-screen";
import { PatientPortalRecetaScreen } from "@/components/portal/patient-portal-receta-screen";
import { PatientPortalWhatsappScreen } from "@/components/portal/patient-portal-whatsapp-screen";
import { PatientPortalBottomNav } from "@/components/portal/patient-portal-bottom-nav";
import { usePatientPortal } from "@/lib/hooks/use-patient-portal";
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
}: Props) {
  const portal = usePatientPortal({ slug, clinicName, doctor, offersPami });

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 pb-20">
      <PatientPortalHeader doctorName={portal.doctorName} doctor={doctor} />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">
        {portal.screen === "inicio" && (
          <PatientPortalHomeScreen
            slug={slug}
            clinicName={clinicName}
            clinicAddress={clinicAddress}
            clinicPhone={clinicPhone}
            portalReady={portal.portalReady}
            setPortalReady={portal.setPortalReady}
            quickActions={portal.quickActions}
            setScreen={portal.setScreen}
          />
        )}

        {portal.screen === "turno" &&
          (professionals.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Turnos online no disponibles. Usá WhatsApp para contactar al consultorio.
            </p>
          ) : (
            <PublicBookingForm
              slug={slug}
              clinicName={clinicName}
              professionals={professionals}
              onRequestSaved={portal.bumpRequestsVersion}
            />
          ))}

        {portal.screen === "receta" && (
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
        )}

        {portal.screen === "whatsapp" && (
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
          />
        )}
      </main>

      <footer className="mx-auto max-w-lg px-4 pb-24 pt-6 text-center text-[11px] text-slate-500">
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
