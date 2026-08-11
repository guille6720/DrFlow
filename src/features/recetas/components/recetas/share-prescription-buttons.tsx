"use client";

import { Mail, MessageCircle } from "lucide-react";
import { useState } from "react";

import { buildWhatsAppShareUrl, buildWhatsAppUrl } from "@/shared/utils/whatsapp";

import type { HistoriaPrescriptionSummary } from "@/features/historias/types/historia-clinical-summaries";
import { WhatsAppShareConfirmDialog } from "@/features/recetas/components/recetas/whatsapp-share-confirm-dialog";
import { buildPrescriptionShareSummary } from "@/features/recetas/utils/build-prescription-share-summary";

import { Button } from "@/components/ui/button";

interface PatientInfo {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
}

interface Props {
  prescription: HistoriaPrescriptionSummary;
  patient: PatientInfo;
}

export function SharePrescriptionButtons({ prescription, patient }: Props) {
  const [whatsappConfirmOpen, setWhatsappConfirmOpen] = useState(false);
  const summary = buildPrescriptionShareSummary(prescription, patient);
  const subject = encodeURIComponent(
    `Receta — ${patient.last_name}, ${patient.first_name}`
  );
  const body = encodeURIComponent(summary);

  const whatsappUrl =
    (patient.phone ? buildWhatsAppUrl(patient.phone, summary) : null) ??
    buildWhatsAppShareUrl(summary);

  function openWhatsApp() {
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setWhatsappConfirmOpen(false);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setWhatsappConfirmOpen(true)}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            window.location.href = `mailto:${patient.email ?? ""}?subject=${subject}&body=${body}`;
          }}
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </Button>
      </div>

      <WhatsAppShareConfirmDialog
        open={whatsappConfirmOpen}
        title="Enviar receta por WhatsApp"
        description={`¿Confirmás el envío a ${patient.last_name}, ${patient.first_name}?`}
        preview={summary}
        onCancel={() => setWhatsappConfirmOpen(false)}
        onConfirm={openWhatsApp}
      />
    </>
  );
}
