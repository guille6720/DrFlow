"use client";

import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { cn } from "@/lib/utils/cn";
import { MessageCircle } from "lucide-react";

interface PatientWhatsAppButtonProps {
  phone: string | null | undefined;
  message: string;
  label?: string;
  size?: "sm" | "md" | "icon";
  className?: string;
}

/** Abre wa.me con mensaje prearmado. */
export function PatientWhatsAppButton({
  phone,
  message,
  label = "WhatsApp",
  size = "sm",
  className,
}: PatientWhatsAppButtonProps) {
  const url = phone ? buildWhatsAppUrl(phone, message) : null;

  if (!url) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs text-slate-400",
          className
        )}
        title="Sin teléfono cargado"
      >
        <MessageCircle className="h-4 w-4" />
        {size !== "icon" && "Sin teléfono"}
      </span>
    );
  }

  if (size === "icon") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm transition hover:bg-[#20bd5a]",
          className
        )}
        title="WhatsApp"
        aria-label={`WhatsApp: ${label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <MessageCircle className="h-5 w-5" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg font-medium text-white transition",
        size === "md" ? "px-4 py-2 text-sm" : "px-2.5 py-1.5 text-xs",
        "bg-[#25D366] hover:bg-[#20bd5a]",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <MessageCircle className={size === "md" ? "h-5 w-5" : "h-4 w-4"} />
      {label}
    </a>
  );
}
