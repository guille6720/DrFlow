"use client";

import { useState } from "react";

import { getMedicalOrderPermissions } from "@/features/ordenes-medicas/actions/medical-orders-v2";
import {
  MedicalOrderDetail,
  type MedicalOrderPermissions,
} from "@/features/ordenes-medicas/components/medical-order-detail";
import { MedicalOrderForm } from "@/features/ordenes-medicas/components/medical-order-form";
import { notifyMedicalOrdersChanged } from "@/features/ordenes-medicas/components/medical-orders-browser";
import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";

import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  patientId: string;
  patientName: string;
  clinicalRecordId?: string;
  onClose: () => void;
  onSaved: () => void;
};

/** "+ Nueva orden médica" from the patient menu / HC (URL: ?tab=ordenes&action=nueva). */
export function PatientOrderSheet({ open, patientId, patientName, clinicalRecordId, onClose, onSaved }: Props) {
  const [created, setCreated] = useState<{ id: string; permissions: MedicalOrderPermissions } | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function handleCreated(result: { id: string }) {
    notifyMedicalOrdersChanged();
    const permissions = await getMedicalOrderPermissions();
    setCreated({ id: result.id, permissions });
  }

  function handleDone() {
    setCreated(null);
    setFormKey((k) => k + 1);
    onSaved();
  }

  function handleClose() {
    if (created) {
      handleDone();
      return;
    }
    onClose();
  }

  return (
    <PatientWorkspaceOverlay
      open={open}
      title={created ? "Orden médica guardada" : "Nueva orden médica"}
      subtitle={patientName}
      onClose={handleClose}
      wide
      headerActions={
        created ? (
          <Button size="sm" onClick={handleDone}>
            Listo
          </Button>
        ) : null
      }
    >
      {open && created ? (
        <MedicalOrderDetail
          orderId={created.id}
          permissions={created.permissions}
          onChanged={notifyMedicalOrdersChanged}
        />
      ) : open ? (
        <MedicalOrderForm
          key={formKey}
          patientId={patientId}
          clinicalRecordId={clinicalRecordId ?? null}
          onCancel={onClose}
          onDone={(res) => void handleCreated(res)}
        />
      ) : null}
    </PatientWorkspaceOverlay>
  );
}
