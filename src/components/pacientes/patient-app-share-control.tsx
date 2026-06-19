"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, MessageCircle, Smartphone } from "lucide-react";
import {
  buildPatientAppInstallUrl,
  buildPatientAppShareMessage,
} from "@/lib/utils/patient-portal-ready";
import { buildWhatsAppShareUrl, buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { recordPatientAppShare } from "@/lib/actions/patient-app-share";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";

import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";

export interface PatientAppShareInfo {
  sharedAt: string;
  sharedByName?: string | null;
  channel?: string | null;
}

interface PatientAppShareControlProps {
  patientId: string;
  patientName: string;
  patientPhone?: string | null;
  slug: string;
  doctor: DoctorShareInfo;
  share?: PatientAppShareInfo | null;
  compact?: boolean;
  className?: string;
}

/** Compartir app pacientes por WhatsApp con registro único por paciente. */
export function PatientAppShareControl({
  patientId,
  patientName,
  patientPhone,
  slug,
  doctor,
  share,
  compact = false,
  className,
}: PatientAppShareControlProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localShare, setLocalShare] = useState<PatientAppShareInfo | null>(share ?? null);
  const [error, setError] = useState<string | null>(null);

  const { installUrl, message, whatsappUrl } = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = buildPatientAppInstallUrl(origin, slug);
    const text = buildPatientAppShareMessage(doctor, url, patientName.split(" ")[0]);
    const directUrl = patientPhone ? buildWhatsAppUrl(patientPhone, text) : null;
    return {
      installUrl: url,
      message: text,
      whatsappUrl: directUrl ?? buildWhatsAppShareUrl(text),
    };
  }, [slug, doctor, patientName, patientPhone]);

  const alreadyShared = Boolean(localShare?.sharedAt);

  function registerShare(channel: "whatsapp" | "copy", onDone: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await recordPatientAppShare(patientId, channel);
      if (result.error) {
        if (result.sharedAt) {
          setLocalShare({ sharedAt: result.sharedAt });
        }
        setError(result.error);
        return;
      }
      if (result.sharedAt) {
        setLocalShare({ sharedAt: result.sharedAt, channel });
      }
      router.refresh();
      onDone();
    });
  }

  function handleWhatsApp() {
    if (alreadyShared || pending) return;
    registerShare("whatsapp", () => {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    });
  }

  function handleCopy() {
    if (alreadyShared || pending) return;
    registerShare("copy", () => {
      void navigator.clipboard.writeText(message);
    });
  }

  if (alreadyShared && localShare) {
    const channelLabel =
      localShare.channel === "copy" ? "mensaje copiado" : "WhatsApp";
    return (
      <div className={cn("space-y-1", className)}>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 text-emerald-700",
            compact ? "text-xs" : "text-sm"
          )}
        >
          <CheckCircle2 className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
          <span className="font-medium">
            App enviada el{" "}
            {format(new Date(localShare.sharedAt), compact ? "d/M/yyyy" : "d 'de' MMMM yyyy", {
              locale: es,
            })}
          </span>
        </div>
        {!compact && (
          <p className="text-xs text-slate-500">
            Por {localShare.sharedByName ?? "el equipo"} · vía {channelLabel}
          </p>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("inline-flex flex-col items-start gap-1", className)}>
        <button
          type="button"
          onClick={handleWhatsApp}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#128C7E] hover:underline disabled:opacity-50"
          title="Compartir app por WhatsApp"
        >
          <Smartphone className="h-3.5 w-3.5" />
          {pending ? "Registrando…" : "Compartir app"}
        </button>
        {error && <span className="text-xs text-amber-700">{error}</span>}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm text-slate-600">
        Enviá por WhatsApp el link para instalar la app de turnos y recetas PAMI. Solo se puede
        compartir una vez por paciente.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="bg-[#25D366] hover:bg-[#20bd5a]"
          onClick={handleWhatsApp}
          disabled={pending}
        >
          <MessageCircle className="h-4 w-4" />
          {pending ? "Registrando…" : "Enviar por WhatsApp"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleCopy} disabled={pending}>
          <Copy className="h-4 w-4" />
          Copiar mensaje
        </Button>
      </div>
      <p className="break-all text-xs text-slate-500">{installUrl}</p>
      {error && <p className="text-sm text-amber-800">{error}</p>}
    </div>
  );
}
