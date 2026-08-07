"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ClipboardList,
  FileText,
  MessageCircle,
  Pill,
  ScrollText,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/shared/utils/cn";
import { buildWhatsAppShareUrl, buildWhatsAppUrl } from "@/shared/utils/whatsapp";

import { usePamiMessages } from "@/features/pami/i18n";
import { ExportPrescriptionPdfButton } from "@/features/recetas/components/recetas/export-prescription-pdf-button";
import { MedicalOrderActionButtons } from "@/features/recetas/components/recetas/medical-order-action-buttons";
import { MedicalOrderPreviewSheet } from "@/features/recetas/components/recetas/medical-order-preview-sheet";
import type {
  PrescriptionsOrdersPatient,
  PrescriptionsOrdersPatientPrescription,
} from "@/features/recetas/components/recetas/prescriptions-orders-types";
import { SharePrescriptionButtons } from "@/features/recetas/components/recetas/share-prescription-buttons";
import { buildMedicalOrderDocumentData } from "@/features/recetas/utils/build-medical-order-document-data";
import { orderTypeLabel } from "@/features/recetas/utils/order-type-label";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MedicalOrder } from "@/types/medical-order";
import { PRESCRIPTION_STATUS_LABELS } from "@/types/prescription";

type Props = {
  patient: PrescriptionsOrdersPatient;
  clinic: { name: string; address?: string | null; phone?: string | null };
  patientPrescriptions: PrescriptionsOrdersPatientPrescription[];
  patientOrders: (MedicalOrder & { order_type?: string })[];
};

export function PrescriptionsOrdersPatientSidebar({
  patient,
  clinic,
  patientPrescriptions,
  patientOrders,
}: Props) {
  const pamiNav = usePamiMessages().nav.commandPalette;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<ReturnType<typeof buildMedicalOrderDocumentData> | null>(
    null
  );

  function openOrderPreview(order: (typeof patientOrders)[number]) {
    setPreviewData(buildMedicalOrderDocumentData(order, patient, clinic, []));
    setPreviewOpen(true);
  }

  return (
    <div className="space-y-4">
      <Card title="Historial del paciente">
        {patientPrescriptions.length === 0 && patientOrders.length === 0 ? (
          <p className="text-sm text-slate-500">
            Todavía no hay recetas ni órdenes para este paciente.
          </p>
        ) : (
          <ul className="max-h-[520px] space-y-3 overflow-y-auto">
            {patientPrescriptions.map((rx) => (
              <li key={`rx-${rx.id}`} className="rounded-xl border border-slate-200 p-3 text-sm">
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
                {rx.status === "issued" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ExportPrescriptionPdfButton
                      prescription={rx}
                      patient={patient}
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
                    <SharePrescriptionButtons prescription={rx} patient={patient} />
                  </div>
                ) : null}
              </li>
            ))}
            {patientOrders.map((order) => {
              const documentData = buildMedicalOrderDocumentData(order, patient, clinic, []);
              const isVoid = order.status === "void";

              return (
                <li
                  key={`ord-${order.id}`}
                  className={cn(
                    "drflow-medical-order-row rounded-xl border border-slate-200 text-sm",
                    !isVoid && "hover:border-blue-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 p-3">
                    <button
                      type="button"
                      disabled={isVoid}
                      onClick={() => openOrderPreview(order)}
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-blue-600" />
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {orderTypeLabel(order.order_type)}
                        </span>
                        <Badge variant={isVoid ? "danger" : "success"}>
                          {order.status === "void" ? "Anulada" : "Emitida"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {format(new Date(order.issued_at), "PPp", { locale: es })}
                      </p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-slate-800">
                        {order.order_text}
                      </p>
                      {!isVoid ? (
                        <p className="mt-2 text-xs font-medium text-blue-700">Clic para vista previa</p>
                      ) : null}
                    </button>
                    {!isVoid ? (
                      <MedicalOrderActionButtons
                        compact
                        data={documentData}
                        onPreview={() => openOrderPreview(order)}
                      />
                    ) : null}
                  </div>
                  {order.status !== "void" && patient.phone ? (
                    <div className="border-t border-slate-100 px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          window.open(
                            (buildWhatsAppUrl(
                              patient.phone!,
                              `Orden médica — ${patient.last_name}, ${patient.first_name}\n\n${order.order_text}${order.notes ? `\n\nIndicaciones: ${order.notes}` : ""}`
                            ) ??
                              buildWhatsAppShareUrl(
                                `Orden médica — ${patient.last_name}, ${patient.first_name}\n\n${order.order_text}${order.notes ? `\n\nIndicaciones: ${order.notes}` : ""}`
                              ))!,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
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
            {pamiNav.guia}
          </Link>
          <Link
            href="/pami/planillas"
            className="inline-flex items-center gap-2 text-blue-700 hover:underline"
          >
            <ClipboardList className="h-4 w-4" />
            {pamiNav.planillas}
          </Link>
        </div>
      </Card>

      {previewData ? (
        <MedicalOrderPreviewSheet
          open={previewOpen}
          data={previewData}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
