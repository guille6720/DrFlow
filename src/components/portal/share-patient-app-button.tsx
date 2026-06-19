"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Copy, MessageCircle } from "lucide-react";
import {
  buildPatientAppInstallUrl,
  buildPatientAppShareMessage,
} from "@/lib/utils/patient-portal-ready";
import { buildWhatsAppShareUrl } from "@/lib/utils/whatsapp";

interface SharePatientAppButtonProps {
  slug: string;
  clinicName: string;
  onCopied?: (message: string) => void;
  className?: string;
}

/** Compartir link de instalación por WhatsApp (el médico elige el contacto). */
export function SharePatientAppButton({
  slug,
  clinicName,
  onCopied,
  className,
}: SharePatientAppButtonProps) {
  const { installUrl, message, whatsappUrl } = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = buildPatientAppInstallUrl(origin, slug);
    const text = buildPatientAppShareMessage(clinicName, url);
    return {
      installUrl: url,
      message: text,
      whatsappUrl: buildWhatsAppShareUrl(text),
    };
  }, [slug, clinicName]);

  function copyMessage() {
    void navigator.clipboard.writeText(message);
    onCopied?.(`Mensaje copiado. Enviálo por WhatsApp a tu paciente:\n${installUrl}`);
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#20bd5a]"
        >
          <MessageCircle className="h-5 w-5 shrink-0" />
          Enviar por WhatsApp
        </a>
        <Button type="button" size="sm" variant="outline" onClick={copyMessage}>
          <Copy className="h-4 w-4" />
          Copiar mensaje
        </Button>
      </div>
      <p className="mt-2 break-all text-xs text-slate-500">{installUrl}</p>
    </div>
  );
}
