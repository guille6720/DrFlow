"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportPrescriptionPdfButton } from "@/components/recetas/export-prescription-pdf";
import type { PrescriptionsOrdersRecentPrescription } from "@/components/recetas/prescriptions-orders-types";
import { getProfessionalDisplayName } from "@/lib/utils/professional";
import { PRESCRIPTION_STATUS_LABELS } from "@/types/prescription";

type Props = {
  recentPrescriptions: PrescriptionsOrdersRecentPrescription[];
  clinic: { name: string; address?: string | null; phone?: string | null };
  onSelectPatient: (patientId: string) => void;
};

export function PrescriptionsOrdersRecentList({
  recentPrescriptions,
  clinic,
  onSelectPatient,
}: Props) {
  if (recentPrescriptions.length === 0) return null;

  return (
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
                  onClick={() => onSelectPatient(rx.patient_id)}
                  className="text-sm text-teal-700 hover:underline"
                >
                  {patient.last_name}, {patient.first_name} — DNI {patient.document_number}
                </button>
                <p className="text-xs text-slate-500">
                  {getProfessionalDisplayName(pro)} ·{" "}
                  {format(new Date(rx.issued_at ?? rx.created_at), "PPp", { locale: es })}
                </p>
              </div>
              {rx.status === "issued" ? (
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
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
