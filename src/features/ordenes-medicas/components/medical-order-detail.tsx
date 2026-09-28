"use client";

import { Ban, Copy, Download, Mail, MessageCircle, Pencil, Printer, ShieldCheck } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { toast } from "@/core/notifications/toast";

import { cn } from "@/shared/utils/cn";
import { buildWhatsAppShareUrl } from "@/shared/utils/whatsapp";

import {
  cancelMedicalOrderV2,
  discardMedicalOrderDraft,
  getMedicalOrderDetailAction,
  recordMedicalOrderEvent,
  sendMedicalOrderEmail,
} from "@/features/ordenes-medicas/actions/medical-orders-v2";
import { MedicalOrderStatusBadge } from "@/features/ordenes-medicas/components/medical-order-status-badge";
import { moCard, moMuted, moText } from "@/features/ordenes-medicas/components/ui-tokens";
import {
  MEDICAL_ORDER_PRIORITY_LABELS,
  MEDICAL_ORDER_SIGNATURE_DISCLAIMER,
} from "@/features/ordenes-medicas/constants";
import type { MedicalOrderDetail as Detail } from "@/features/ordenes-medicas/types";
import {
  buildMedicalOrderVerifyUrl,
  categoryLabel,
  describeItemMetadata,
  formatDateAr,
  formatDateTimeAr,
} from "@/features/ordenes-medicas/utils/medical-order-format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type MedicalOrderPermissions = {
  canView: boolean;
  canIssue: boolean;
  canCancel: boolean;
  canShare: boolean;
};

type Props = {
  orderId: string;
  permissions: MedicalOrderPermissions;
  onChanged: () => void;
  onEditDraft?: (detail: Detail) => void;
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className={cn("text-[11px] uppercase tracking-wide", moMuted)}>{label}</dt>
      <dd className={cn("whitespace-pre-wrap text-sm", moText)}>{value}</dd>
    </div>
  );
}

export function MedicalOrderDetail({ orderId, permissions, onChanged, onEditDraft }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getMedicalOrderDetailAction(orderId).then((res) => {
      if (cancelled) return;
      if (res.ok) setDetail(res.data);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, reloadKey]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!detail) return <p className={cn("text-sm", moMuted)}>Cargando orden…</p>;

  const verifyUrl =
    detail.public_verification_token && typeof window !== "undefined"
      ? buildMedicalOrderVerifyUrl(window.location.origin, detail.public_verification_token)
      : null;
  const issued = detail.status === "issued";
  const isDraft = detail.status === "draft";
  const issuer = detail.issuer_snapshot;
  const patient = detail.patient_snapshot;

  function track(event: "pdf" | "print" | "copy_link" | "whatsapp") {
    void recordMedicalOrderEvent(detail!.id, event);
  }

  async function handlePdf(print: boolean) {
    const mod = await import("@/features/ordenes-medicas/utils/export-medical-order-pdf");
    try {
      if (print) await mod.printMedicalOrderPdf(detail!, verifyUrl);
      else await mod.downloadMedicalOrderPdf(detail!, verifyUrl);
      track(print ? "print" : "pdf");
    } catch {
      toast.error("No se pudo generar el PDF");
    }
  }

  async function handleCopy() {
    if (!verifyUrl) return;
    try {
      await navigator.clipboard.writeText(verifyUrl);
      toast.success("Enlace seguro copiado");
      track("copy_link");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  function handleWhatsApp() {
    if (!verifyUrl) return;
    const msg = `Orden médica ${detail!.order_number ?? ""} (${categoryLabel(detail!.order_category)}). Verificala en: ${verifyUrl}`;
    window.open(buildWhatsAppShareUrl(msg), "_blank", "noopener,noreferrer");
    track("whatsapp");
  }

  function handleCancel() {
    startTransition(async () => {
      const res = await cancelMedicalOrderV2(detail!.id, reason);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Orden anulada");
      setCancelOpen(false);
      setReason("");
      setReloadKey((k) => k + 1);
      onChanged();
    });
  }

  function handleDiscard() {
    if (!window.confirm("¿Descartar este borrador? No se puede deshacer.")) return;
    startTransition(async () => {
      const res = await discardMedicalOrderDraft(detail!.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Borrador descartado");
      onChanged();
    });
  }

  function handleEmail() {
    startTransition(async () => {
      const res = await sendMedicalOrderEmail(detail!.id, email);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Enlace enviado por email");
      setEmailOpen(false);
    });
  }

  const licenses = [
    issuer?.license_national ? `MN ${issuer.license_national}` : null,
    issuer?.license_provincial ? `MP ${issuer.license_provincial}` : null,
    !issuer?.license_national && !issuer?.license_provincial && issuer?.license_number ? `Mat. ${issuer.license_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={cn("text-xs uppercase tracking-wide", moMuted)}>{categoryLabel(detail.order_category)}</p>
          <p className={cn("text-xl font-semibold", moText)}>{detail.order_number ?? (isDraft ? "Borrador" : "Orden")}</p>
          <p className={cn("text-sm", moMuted)}>
            {detail.issued_at ? `Emitida ${formatDateTimeAr(detail.issued_at)}` : `Creada ${formatDateTimeAr(detail.created_at)}`}
            {detail.valid_until ? ` · Válida hasta ${formatDateAr(detail.valid_until)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {detail.priority && detail.priority !== "normal" ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                detail.priority === "urgente" ? "bg-red-600 text-white" : "bg-amber-500 text-white"
              )}
            >
              {MEDICAL_ORDER_PRIORITY_LABELS[detail.priority]}
            </span>
          ) : null}
          <MedicalOrderStatusBadge status={detail.status} />
        </div>
      </div>

      {detail.status === "void" ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">ANULADA el {formatDateTimeAr(detail.voided_at)}</p>
          {detail.void_reason ? <p>Motivo: {detail.void_reason}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isDraft && permissions.canIssue && onEditDraft ? (
          <Button size="sm" onClick={() => onEditDraft(detail)}>
            <Pencil className="h-4 w-4" /> Editar / emitir borrador
          </Button>
        ) : null}
        {isDraft && permissions.canIssue ? (
          <Button size="sm" variant="outline" onClick={handleDiscard} disabled={pending}>
            Descartar borrador
          </Button>
        ) : null}
        {!isDraft && permissions.canShare ? (
          <>
            <Button size="sm" variant="outline" onClick={() => void handlePdf(false)}>
              <Download className="h-4 w-4" /> Descargar PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handlePdf(true)}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </>
        ) : null}
        {issued && permissions.canShare && verifyUrl ? (
          <>
            <Button size="sm" variant="outline" onClick={() => void handleCopy()}>
              <Copy className="h-4 w-4" /> Copiar enlace seguro
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEmailOpen((v) => !v)}>
              <Mail className="h-4 w-4" /> Email
            </Button>
            <Button size="sm" variant="outline" onClick={handleWhatsApp}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </>
        ) : null}
        {issued && permissions.canCancel ? (
          <Button size="sm" variant="danger" onClick={() => setCancelOpen((v) => !v)}>
            <Ban className="h-4 w-4" /> Anular
          </Button>
        ) : null}
      </div>

      {emailOpen ? (
        <div className={cn(moCard, "flex flex-wrap items-end gap-2 p-3")}>
          <div className="min-w-[240px] flex-1">
            <Input
              label="Enviar enlace de verificación a"
              type="email"
              value={email}
              placeholder="paciente@email.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={handleEmail} loading={pending} disabled={!email.trim()}>
            Enviar
          </Button>
        </div>
      ) : null}

      {cancelOpen ? (
        <div className="space-y-2 rounded-xl border border-red-300 p-3">
          <Textarea
            label="Motivo de la anulación"
            value={reason}
            rows={2}
            maxLength={500}
            required
            onChange={(e) => setReason(e.target.value)}
          />
          <p className={cn("text-xs", moMuted)}>
            La orden no se elimina: queda en el historial como ANULADA y su QR mostrará el estado anulado.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setCancelOpen(false)}>
              Volver
            </Button>
            <Button size="sm" variant="danger" onClick={handleCancel} loading={pending} disabled={reason.trim().length < 5}>
              Confirmar anulación
            </Button>
          </div>
        </div>
      ) : null}

      <section className={cn(moCard, "grid gap-3 p-3 sm:grid-cols-2")}>
        <Field
          label="Paciente"
          value={
            patient ? `${patient.last_name ?? ""}, ${patient.first_name ?? ""}` : detail.patient_name
          }
        />
        <Field label={patient?.document_type ?? "DNI"} value={patient?.document_number ?? detail.patient_document} />
        <Field
          label="Cobertura"
          value={[patient?.insurance_provider, patient?.insurance_plan, patient?.insurance_number].filter(Boolean).join(" · ")}
        />
        <Field label="Profesional" value={issuer?.full_name ?? detail.professional_name} />
        <Field label="Especialidad" value={issuer?.specialty} />
        <Field label="Matrícula" value={licenses} />
      </section>

      <section className={cn(moCard, "space-y-3 p-3")}>
        <h4 className={cn("text-sm font-semibold", moText)}>Se solicita</h4>
        {detail.items.length > 0 ? (
          <ol className="list-decimal space-y-1 pl-5">
            {detail.items.map((item) => (
              <li key={item.id ?? item.name} className={cn("text-sm", moText)}>
                <span className="font-medium">{item.name}</span>
                {[...describeItemMetadata(item.metadata), item.description].filter(Boolean).map((line) => (
                  <span key={String(line)} className={cn("block text-xs", moMuted)}>
                    {line}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        ) : (
          <p className={cn("whitespace-pre-wrap text-sm", moText)}>{detail.order_text}</p>
        )}
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Diagnóstico"
            value={[detail.diagnosis_text, detail.diagnosis_code ? `CIE-10 ${detail.diagnosis_code}` : null].filter(Boolean).join(" · ")}
          />
          <Field label="Indicación clínica" value={detail.clinical_indication} />
          <Field label="Preparación" value={detail.preparation_instructions} />
          <Field label="Observaciones" value={detail.notes} />
        </dl>
      </section>

      {detail.isV2 && !isDraft ? (
        <section className={cn("flex items-start gap-2 rounded-xl p-3 text-xs", moMuted, "border border-dashed border-[var(--border)]")}>
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p>{MEDICAL_ORDER_SIGNATURE_DISCLAIMER}</p>
            {detail.document_hash ? <p className="break-all font-mono">SHA-256: {detail.document_hash}</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
