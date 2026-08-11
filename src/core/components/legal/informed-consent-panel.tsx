"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

import type { InformedConsentRecord } from "@/core/compliance/informed-consent-types";
import { ExportInformedConsentPdfButton } from "@/core/components/legal/export-informed-consent-pdf-button";
import {
  buildInformedConsentProcedureDefault,
  INFORMED_CONSENT_DECLARATION_PARAGRAPHS,
  INFORMED_CONSENT_DOCUMENT_VERSION,
  informedConsentPatientDisplayName,
} from "@/core/legal/informed-consent";
import { toast } from "@/core/notifications/toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getInformedConsentForClinicalRecord,
  recordInformedConsent,
} from "@/lib/actions/informed-consent";

type Props = {
  patientId: string;
  clinicalRecordId: string;
  appointmentId?: string | null;
  chiefComplaint?: string | null;
  patient: {
    first_name: string;
    last_name: string;
    document_number: string;
    birth_date?: string | null;
  };
  professional: {
    full_name: string;
    license_number?: string | null;
  };
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  canEdit: boolean;
  initialConsent?: InformedConsentRecord | null;
};

export function InformedConsentPanel({
  patientId,
  clinicalRecordId,
  appointmentId,
  chiefComplaint,
  patient,
  professional,
  clinic,
  canEdit,
  initialConsent = null,
}: Props) {
  const [consent, setConsent] = useState<InformedConsentRecord | null>(initialConsent);
  const [loading, setLoading] = useState(initialConsent === undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaultSignature = informedConsentPatientDisplayName(patient.first_name, patient.last_name);
  const [procedureDescription, setProcedureDescription] = useState(
    buildInformedConsentProcedureDefault(chiefComplaint)
  );
  const [signatureName, setSignatureName] = useState(defaultSignature);
  const [notes, setNotes] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (initialConsent !== undefined) return;
    let cancelled = false;
    getInformedConsentForClinicalRecord(clinicalRecordId).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else setConsent(result.data ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clinicalRecordId, initialConsent]);

  const handleSubmit = useCallback(() => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("patient_id", patientId);
      formData.set("clinical_record_id", clinicalRecordId);
      if (appointmentId) formData.set("appointment_id", appointmentId);
      formData.set("procedure_description", procedureDescription);
      formData.set("signature_name", signatureName);
      formData.set("notes", notes);
      if (acknowledged) formData.set("informed_consent_acknowledged", "true");

      const result = await recordInformedConsent(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setConsent(result.data ?? null);
      setAcknowledged(false);
      toast.success("Consentimiento informado registrado.");
    });
  }, [
    acknowledged,
    appointmentId,
    clinicalRecordId,
    notes,
    patientId,
    procedureDescription,
    signatureName,
  ]);

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando consentimiento informado…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (consent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <p className="font-semibold text-emerald-900">Consentimiento informado registrado</p>
              <p className="mt-1 text-sm text-emerald-800">
                {consent.signatureName} ·{" "}
                {consent.grantedAt
                  ? format(new Date(consent.grantedAt), "PPp", { locale: es })
                  : "—"}
              </p>
              <p className="mt-1 text-sm text-emerald-800">{consent.procedureDescription}</p>
              {consent.recordedByName ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Registrado por {consent.recordedByName} · v
                  {consent.documentVersion ?? INFORMED_CONSENT_DOCUMENT_VERSION}
                </p>
              ) : null}
            </div>
          </div>
          <ExportInformedConsentPdfButton
            consent={consent}
            patient={patient}
            professional={professional}
            clinic={clinic}
          />
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Sin consentimiento informado registrado para esta consulta.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-teal-700" />
        <div>
          <p className="font-semibold text-slate-900">Consentimiento informado (Ley 26.529)</p>
          <p className="mt-1 text-sm text-slate-600">
            Registrá que el paciente fue informado sobre el acto médico y acreditó su consentimiento.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Textarea
          label="Acto / procedimiento informado"
          value={procedureDescription}
          onChange={(e) => setProcedureDescription(e.target.value)}
          rows={3}
        />
        <Input
          label="Nombre del paciente o representante"
          value={signatureName}
          onChange={(e) => setSignatureName(e.target.value)}
        />
        <Textarea
          label="Observaciones (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span>
            {INFORMED_CONSENT_DECLARATION_PARAGRAPHS.map((paragraph, index) => (
              <span key={index} className={index > 0 ? "mt-2 block" : "block"}>
                {paragraph}
              </span>
            ))}
          </span>
        </label>
        <Button
          type="button"
          loading={pending}
          disabled={!acknowledged || procedureDescription.trim().length < 3 || signatureName.trim().length < 2}
          onClick={handleSubmit}
        >
          Registrar consentimiento informado
        </Button>
      </div>
    </div>
  );
}
