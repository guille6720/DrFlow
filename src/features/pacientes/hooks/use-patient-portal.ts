"use client";

import { Bell, Calendar, Home, MessageCircle, Pill } from "lucide-react";
import { useEffect, useState } from "react";

import { buildPrescriptionRequestMessage } from "@/features/pacientes/utils/patient-messages";
import { isPatientPortalReady } from "@/features/pacientes/utils/patient-portal-ready";
import {
  addPatientRequest,
  getStoredDocument,
} from "@/features/pacientes/utils/patient-requests-storage";

import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";

export type PatientPortalScreen = "inicio" | "turno" | "receta" | "turnos" | "whatsapp";

export const PATIENT_PORTAL_NAV: { id: PatientPortalScreen; label: string; icon: typeof Home }[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "turno", label: "Turno", icon: Calendar },
  { id: "turnos", label: "Mis turnos", icon: Bell },
  { id: "receta", label: "Receta", icon: Pill },
];

type Options = {
  slug: string;
  clinicName: string;
  doctor?: DoctorShareInfo | null;
  offersPami?: boolean;
};

export function usePatientPortal({ slug, clinicName, doctor, offersPami = false }: Options) {
  const [screen, setScreen] = useState<PatientPortalScreen>("inicio");
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

  const doctorName = doctor?.fullName ?? clinicName;
  const recetaTitle = offersPami ? "Receta PAMI" : "Solicitar receta";
  const recetaMessage = buildPrescriptionRequestMessage({
    patientName: patientName || "Paciente",
    documentNumber: documentNumber || "________",
    medications: medications || "________________",
    insuranceNumber: insuranceNumber || undefined,
    pamiBranding: offersPami,
  });

  const quickActions = [
    {
      id: "turno" as PatientPortalScreen,
      title: "Pedir turno",
      desc: "Elegí día y horario",
      icon: Calendar,
      color: "from-emerald-500 to-emerald-700",
    },
    {
      id: "turnos" as PatientPortalScreen,
      title: "Mis turnos",
      desc: "Ver o cancelar",
      icon: Bell,
      color: "from-blue-500 to-blue-700",
    },
    {
      id: "receta" as PatientPortalScreen,
      title: recetaTitle,
      desc: "Renovar medicación",
      icon: Pill,
      color: "from-violet-500 to-violet-700",
    },
    {
      id: "whatsapp" as PatientPortalScreen,
      title: "WhatsApp",
      desc: "Hablar con el médico",
      icon: MessageCircle,
      color: "from-[#128C7E] to-[#075E54]",
    },
  ];

  function bumpRequestsVersion() {
    setRequestsVersion((v) => v + 1);
  }

  return {
    screen,
    setScreen,
    portalReady,
    setPortalReady,
    patientName,
    setPatientName,
    documentNumber,
    setDocumentNumber,
    insuranceNumber,
    setInsuranceNumber,
    medications,
    setMedications,
    requestsVersion,
    bumpRequestsVersion,
    logWhatsappRequest,
    doctorName,
    recetaMessage,
    quickActions,
  };
}

export type PatientPortalState = ReturnType<typeof usePatientPortal>;
