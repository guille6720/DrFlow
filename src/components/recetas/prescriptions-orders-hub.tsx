"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ClipboardList,
  FileText,
  MessageCircle,
  Pill,
  ScrollText,
  Stethoscope,
  User,
  ArrowLeft,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrescriptionForm } from "@/components/recetas/prescription-form";
import { MedicalOrderForm } from "@/components/recetas/medical-order-form";
import { ExportPrescriptionPdfButton } from "@/components/recetas/export-prescription-pdf";
import { SharePrescriptionButtons } from "@/components/recetas/share-prescription-buttons";
import {
  PatientSearchCombobox,
  type PatientSearchOption,
} from "@/components/pacientes/patient-search-combobox";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import { PRESCRIPTION_STATUS_LABELS } from "@/types/prescription";
import type { ElectronicPrescription, PrescriptionMedication } from "@/types/prescription";
import type { MedicalOrder } from "@/types/medical-order";
import { cn } from "@/lib/utils/cn";
import {
  buildConsultaHref,
  consultationDraftKey,
  parseConsultationDraftContext,
  readConsultationEvolution,
} from "@/lib/utils/consultation-draft";
import {
  extractEvolutionDiagnosis,
  parseEvolutionMedications,
} from "@/lib/utils/parse-evolution-medications";

type DocTab = "receta" | "orden";

interface Professional {
  id: string;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | null;
}

interface PatientDetail extends PatientSearchOption {
  birth_date?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
  phone?: string | null;
  email?: string | null;
  regular_medication?: string | null;
}

interface Props {
  patients: PatientSearchOption[];
  professionals: Professional[];
  clinic: { name: string; address?: string | null; phone?: string | null };
  selectedPatient: PatientDetail | null;
  patientPrescriptions: Array<
    ElectronicPrescription & {
      professionals?: {
        display_name?: string | null;
        license_number?: string | null;
        profiles?: { full_name?: string } | null;
        specialties?: { name?: string } | null;
      } | null;
    }
  >;
  patientOrders: (MedicalOrder & { order_type?: string })[];
  recentPrescriptions: Array<
    ElectronicPrescription & {
      patient_id: string;
      patients: {
        first_name: string;
        last_name: string;
        document_number: string;
        birth_date?: string | null;
        insurance_provider?: string | null;
      };
      professionals: {
        display_name?: string | null;
        license_number?: string | null;
        profiles?: { full_name?: string } | null;
        specialties?: { name?: string } | null;
      };
    }
  >;
  prefillDiagnosis?: string;
  prefillCie10?: string;
  initialMedications?: PrescriptionMedication[];
  defaultProfessionalId?: string;
  defaultTab: DocTab;
}

function orderTypeLabel(type?: string) {
  if (type === "referral") return "Derivación";
  if (type === "pami_form") return "Planilla PAMI";
  return "Estudios";
}

function buildOrderWhatsAppUrl(phone: string | null | undefined, text: string) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  const url = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${url}?text=${encodeURIComponent(text)}`;
}

export function PrescriptionsOrdersHub({
  patients,
  professionals,
  clinic,
  selectedPatient,
  patientPrescriptions,
  patientOrders,
  recentPrescriptions,
  prefillDiagnosis = "",
  prefillCie10 = "",
  initialMedications,
  defaultProfessionalId,
  defaultTab,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultationContext = useMemo(
    () => parseConsultationDraftContext(searchParams),
    [searchParams]
  );
  const draftKey = useMemo(
    () => (consultationContext ? consultationDraftKey(consultationContext) : null),
    [consultationContext]
  );
  const [consultaDiagnosis, setConsultaDiagnosis] = useState("");
  const [prevDraftKey, setPrevDraftKey] = useState(draftKey);

  if (draftKey !== prevDraftKey) {
    setPrevDraftKey(draftKey);
    setConsultaDiagnosis(draftKey ? readConsultationEvolution(draftKey) : "");
  }

  useEffect(() => {
    if (draftKey == null) return;
    const storageKey: string = draftKey;
    function syncEvolution() {
      setConsultaDiagnosis(readConsultationEvolution(storageKey));
    }
    document.addEventListener("visibilitychange", syncEvolution);
    window.addEventListener("focus", syncEvolution);
    return () => {
      document.removeEventListener("visibilitychange", syncEvolution);
      window.removeEventListener("focus", syncEvolution);
    };
  }, [draftKey]);

  const consultaMedications = useMemo(() => {
    if (!consultationContext) return [];
    return parseEvolutionMedications(consultaDiagnosis);
  }, [consultationContext, consultaDiagnosis]);

  const diagnosisForForm =
    consultationContext && consultaDiagnosis.trim()
      ? extractEvolutionDiagnosis(consultaDiagnosis) || consultaDiagnosis.slice(0, 500)
      : prefillDiagnosis;

  const medicationsForForm =
    consultationContext && consultaMedications.length > 0
      ? consultaMedications
      : initialMedications;

  const activeTab: DocTab = searchParams.get("tipo") === "orden" ? "orden" : defaultTab;

  function buildNavigateParams(patientId: string | null, tab: DocTab) {
    const params = new URLSearchParams();
    if (patientId) params.set("patient", patientId);
    if (tab === "orden") params.set("tipo", "orden");
    if (consultationContext) {
      params.set("consulta", "1");
      if (consultationContext.appointmentId) {
        params.set("appointment", consultationContext.appointmentId);
      }
      params.set("patient", consultationContext.patientId);
      if (consultationContext.professionalId) {
        params.set("professional", consultationContext.professionalId);
      }
      if (consultationContext.recordId) {
        params.set("record", consultationContext.recordId);
      }
    }
    return params;
  }

  function navigate(patientId: string | null, tab: DocTab = activeTab) {
    const params = buildNavigateParams(patientId, tab);
    const qs = params.toString();
    router.push(qs ? `/recetas?${qs}` : "/recetas");
  }

  function setTab(tab: DocTab) {
    navigate(selectedPatient?.id ?? null, tab);
  }

  const defaultPro =
    consultationContext?.professionalId ?? defaultProfessionalId ?? professionals[0]?.id;

  return (
    <div className="space-y-4">
      {consultationContext && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-500/40 bg-teal-950/50 px-4 py-3">
          <Link
            href={buildConsultaHref(consultationContext)}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-500"
          >
            <ArrowLeft className="h-4 w-4" />
            {consultationContext.recordId ? "Volver a editar consulta" : "Volver a consulta en curso"}
          </Link>
          <p className="text-sm text-teal-100">
            {consultaMedications.length > 0
              ? `${consultaMedications.length} medicamento(s) precargado(s) desde la evolución.`
              : "La evolución de la consulta se usará como diagnóstico si no hay medicación con viñeta."}
          </p>
        </div>
      )}

      <Card title="Paciente">
        <PatientSearchCombobox
          patients={patients}
          label="Buscar paciente"
          placeholder="Nombre, apellido o DNI…"
          defaultPatientId={selectedPatient?.id}
          onPatientChange={(id) => navigate(id || null, activeTab)}
        />
        {!selectedPatient && (
          <p className="mt-3 text-sm text-slate-500">
            Elegí un paciente para generar recetas u órdenes. También podés entrar desde{" "}
            <Link href="/pacientes" className="text-teal-700 hover:underline">
              Pacientes
            </Link>{" "}
            o la historia clínica.
          </p>
        )}
      </Card>

      {selectedPatient && (
        <>
          <div className="drflow-card-light flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-teal-50/40 p-4 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-md">
              <User className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-slate-900">
                {selectedPatient.last_name}, {selectedPatient.first_name}
              </p>
              <p className="text-sm text-slate-600">
                DNI {selectedPatient.document_number}
                {selectedPatient.insurance_provider
                  ? ` · ${selectedPatient.insurance_provider}`
                  : ""}
                {selectedPatient.insurance_number
                  ? ` · Af. ${selectedPatient.insurance_number}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/historias/paciente/${selectedPatient.id}`}>
                <Button variant="outline" size="sm">
                  Historia clínica
                </Button>
              </Link>
              <Link href={`/pacientes/${selectedPatient.id}`}>
                <Button variant="outline" size="sm">
                  Ficha del paciente
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setTab("receta")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
                activeTab === "receta"
                  ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 shadow-md"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <ScrollText className="h-4 w-4" />
              Receta
            </button>
            <button
              type="button"
              onClick={() => setTab("orden")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
                activeTab === "orden"
                  ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 shadow-md"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <ClipboardList className="h-4 w-4" />
              Orden
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,340px)]">
            <Card
              title={activeTab === "receta" ? "Nueva receta electrónica" : "Nueva orden médica"}
              description={
                activeTab === "receta"
                  ? "Emisión local conforme Ley 25.649"
                  : "Estudios, derivaciones PAMI e indicaciones"
              }
            >
              {activeTab === "receta" ? (
                <>
                  {consultationContext && consultaMedications.length > 0 && (
                    <p className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
                      <Pill className="mr-1 inline h-4 w-4" />
                      Medicación importada desde la evolución de la consulta en curso. Revisá posología y
                      presentación antes de emitir.
                    </p>
                  )}
                  {!consultationContext && initialMedications && initialMedications.length > 0 && (
                    <p className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
                      <Pill className="mr-1 inline h-4 w-4" />
                      Medicación precargada desde la última receta o tratamiento habitual. Revisá antes de emitir.
                    </p>
                  )}
                  <PrescriptionForm
                    key={
                      draftKey
                        ? `consulta-${draftKey}-${consultaMedications.length}-${diagnosisForForm.length}`
                        : "default"
                    }
                    patientId={selectedPatient.id}
                    patientInsurance={selectedPatient.insurance_provider}
                    diagnosisDefault={diagnosisForForm}
                    cie10Default={prefillCie10}
                    professionals={professionals}
                    defaultProfessionalId={defaultPro}
                    initialMedications={medicationsForForm}
                    clinicalRecordId={consultationContext?.recordId}
                    onSuccess={() => router.refresh()}
                  />
                </>
              ) : (
                <MedicalOrderForm
                  patientId={selectedPatient.id}
                  professionals={professionals}
                  defaultProfessionalId={defaultPro}
                  onSuccess={() => router.refresh()}
                />
              )}
            </Card>

            <div className="space-y-4">
              <Card title="Historial del paciente">
                {patientPrescriptions.length === 0 && patientOrders.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Todavía no hay recetas ni órdenes para este paciente.
                  </p>
                ) : (
                  <ul className="max-h-[520px] space-y-3 overflow-y-auto">
                    {patientPrescriptions.map((rx) => (
                      <li
                        key={`rx-${rx.id}`}
                        className="rounded-xl border border-slate-200 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <ScrollText className="h-3.5 w-3.5 text-teal-600" />
                          <span className="font-medium text-slate-900">
                            {rx.prescription_number ?? "Receta"}
                          </span>
                          <Badge
                            variant={
                              rx.status === "issued"
                                ? "success"
                                : rx.status === "void"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {PRESCRIPTION_STATUS_LABELS[rx.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {format(new Date(rx.issued_at ?? rx.created_at), "PPp", { locale: es })}
                          {rx.diagnosis_text ? ` · ${rx.diagnosis_text}` : ""}
                        </p>
                        {rx.status === "issued" && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <ExportPrescriptionPdfButton
                              prescription={rx}
                              patient={selectedPatient}
                              professional={{
                                full_name:
                                  rx.professionals?.profiles?.full_name ??
                                  rx.professionals?.display_name ??
                                  "Profesional",
                                license_number: rx.professionals?.license_number ?? null,
                                specialty: rx.professionals?.specialties?.name,
                              }}
                              clinic={clinic}
                            />
                            <SharePrescriptionButtons prescription={rx} patient={selectedPatient} />
                          </div>
                        )}
                      </li>
                    ))}
                    {patientOrders.map((order) => (
                      <li
                        key={`ord-${order.id}`}
                        className="rounded-xl border border-slate-200 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {orderTypeLabel(order.order_type)}
                          </span>
                          <Badge variant={order.status === "void" ? "danger" : "success"}>
                            {order.status === "void" ? "Anulada" : "Emitida"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {format(new Date(order.issued_at), "PPp", { locale: es })}
                        </p>
                        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-slate-800">
                          {order.order_text}
                        </p>
                        {order.status !== "void" && selectedPatient.phone && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() =>
                              window.open(
                                buildOrderWhatsAppUrl(
                                  selectedPatient.phone,
                                  `Orden médica — ${selectedPatient.last_name}, ${selectedPatient.first_name}\n\n${order.order_text}${order.notes ? `\n\nIndicaciones: ${order.notes}` : ""}`
                                ),
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Accesos rápidos">
                <div className="flex flex-col gap-2 text-sm">
                  <Link
                    href="/herramientas/farmacologia"
                    className="inline-flex items-center gap-2 text-violet-700 hover:underline"
                  >
                    <Pill className="h-4 w-4" />
                    Guía farmacológica
                  </Link>
                  <Link
                    href="/guia-pami"
                    className="inline-flex items-center gap-2 text-teal-700 hover:underline"
                  >
                    <Stethoscope className="h-4 w-4" />
                    Guía cabecera PAMI
                  </Link>
                  <Link
                    href="/pami/planillas"
                    className="inline-flex items-center gap-2 text-blue-700 hover:underline"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Planillas PAMI
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {!selectedPatient && recentPrescriptions.length > 0 && (
        <Card title="Recientes en el consultorio">
          <ul className="divide-y divide-slate-100">
            {recentPrescriptions.map((rx) => {
              const patient = rx.patients;
              const pro = rx.professionals;
              return (
                <li
                  key={rx.id}
                  className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">
                        {rx.prescription_number ?? rx.id.slice(0, 8)}
                      </p>
                      <Badge
                        variant={
                          rx.status === "issued"
                            ? "success"
                            : rx.status === "void"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {PRESCRIPTION_STATUS_LABELS[rx.status]}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(rx.patient_id)}
                      className="text-sm text-teal-700 hover:underline"
                    >
                      {patient.last_name}, {patient.first_name} — DNI {patient.document_number}
                    </button>
                    <p className="text-xs text-slate-500">
                      {getProfessionalDisplayName(pro)} ·{" "}
                      {format(new Date(rx.issued_at ?? rx.created_at), "PPp", { locale: es })}
                    </p>
                  </div>
                  {rx.status === "issued" && (
                    <ExportPrescriptionPdfButton
                      prescription={rx}
                      patient={patient}
                      professional={{
                        full_name: pro.profiles?.full_name ?? pro.display_name ?? "Profesional",
                        license_number: pro.license_number,
                        specialty: pro.specialties?.name,
                      }}
                      clinic={clinic}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
