"use client";

import { useEffect, useState } from "react";

import { getMedicalOrderPermissions } from "@/features/ordenes-medicas/actions/medical-orders-v2";
import type { MedicalOrderPermissions } from "@/features/ordenes-medicas/components/medical-order-detail";
import { MedicalOrdersBrowser } from "@/features/ordenes-medicas/components/medical-orders-browser";
import { ClinicalIntegrationsCard } from "@/features/pacientes/components/pacientes/clinical-integrations/clinical-integrations-card";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Card } from "@/components/ui/card";

type Props = {
  patientId: string;
  patient: {
    first_name: string;
    last_name: string;
  };
};

export function PatientWorkspaceOrdersPanel({ patientId, patient }: Props) {
  const [permissions, setPermissions] = useState<MedicalOrderPermissions | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMedicalOrderPermissions().then((p) => {
      if (!cancelled) setPermissions(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
    <ClinicalIntegrationsCard patientId={patientId} section="medicalOrders" />
    <Card title="Órdenes médicas">
      {!permissions ? (
        <p className="text-sm text-[var(--text-muted,var(--muted-foreground))]">Cargando…</p>
      ) : !permissions.canView ? (
        <p className="text-sm text-[var(--text-muted,var(--muted-foreground))]">
          Tu rol no tiene permiso para ver órdenes médicas.
        </p>
      ) : (
        <MedicalOrdersBrowser
          permissions={permissions}
          patientId={patientId}
          patientLabel={`${patient.last_name}, ${patient.first_name}`}
          newOrderHref={buildPatientWorkspaceUrl(patientId, { tab: "ordenes", action: "nueva" })}
        />
      )}
    </Card>
    </>
  );
}
