"use client";

import Link from "next/link";
import { useState } from "react";
import { PublicBookingForm } from "@/components/booking/public-booking-form";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildPrescriptionRequestMessage } from "@/lib/utils/patient-messages";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { AppInstallCard } from "@/components/portal/app-install-card";
import { Calendar, Pill, MessageCircle } from "lucide-react";

type Tab = "turno" | "receta" | "whatsapp";

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
}

export function PatientPortalView({
  slug,
  clinicName,
  clinicPhone,
  clinicAddress,
  professionals,
}: Props) {
  const [tab, setTab] = useState<Tab>("turno");
  const [patientName, setPatientName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [medications, setMedications] = useState("");

  const recetaMessage = buildPrescriptionRequestMessage({
    patientName: patientName || "Paciente",
    documentNumber: documentNumber || "________",
    medications: medications || "________________",
    insuranceNumber: insuranceNumber || undefined,
  });

  const tabs: { id: Tab; label: string; icon: typeof Calendar }[] = [
    { id: "turno", label: "Turno", icon: Calendar },
    { id: "receta", label: "Receta", icon: Pill },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50">
      <header className="border-b border-blue-100 bg-white/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3 pb-2">
          <DrFlowLogo size="md" href="/" />
          <div className="text-center">
            <h1 className="font-bold text-slate-900">{clinicName}</h1>
            <p className="text-xs text-slate-500">Portal pacientes</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <AppInstallCard
          slug={slug}
          clinicName={clinicName}
          className="mb-6"
        />

        {clinicAddress && (
          <p className="mb-4 text-center text-sm text-slate-500">{clinicAddress}</p>
        )}

        <div className="mb-6 flex rounded-xl border border-slate-200 bg-white p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "turno" && (
          <div>
            {professionals.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Turnos online no disponibles. Contactá al consultorio por WhatsApp.
              </p>
            ) : (
              <PublicBookingForm
                slug={slug}
                clinicName={clinicName}
                professionals={professionals}
              />
            )}
          </div>
        )}

        {tab === "receta" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-600">
              Completá tus datos y enviá la solicitud de receta por WhatsApp al consultorio.
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
              label="Medicación que necesitás renovar"
              rows={4}
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              placeholder="Ej: Enalapril 10 mg, Metformina 850 mg..."
              required
            />
            <div className="flex flex-wrap gap-2">
              <PatientWhatsAppButton
                phone={clinicPhone}
                message={recetaMessage}
                label="Enviar solicitud por WhatsApp"
                size="md"
              />
            </div>
          </div>
        )}

        {tab === "whatsapp" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-center">
            <MessageCircle className="mx-auto h-12 w-12 text-[#25D366]" />
            <p className="text-sm text-slate-600">
              Escribile directo al consultorio por WhatsApp para consultas, turnos o recetas.
            </p>
            <PatientWhatsAppButton
              phone={clinicPhone}
              message={`Hola, soy paciente de ${clinicName}. Quisiera hacer una consulta.`}
              label="Abrir WhatsApp"
              size="md"
              className="mx-auto"
            />
            {!clinicPhone && (
              <p className="text-xs text-amber-700">
                El consultorio no tiene teléfono cargado. Pedí el número en recepción.
              </p>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/" className="text-blue-700 hover:underline">
            DrFlow
          </Link>
          {" · Portal pacientes"}
        </p>
      </main>
    </div>
  );
}
