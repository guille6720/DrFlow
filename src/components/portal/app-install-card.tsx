"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type AppInstallVariant = "clinic" | "patient";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function registerServiceWorker(scope: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope });
  } catch {
    /* La descarga del icono sigue disponible sin SW. */
  }
}

interface AppInstallCardProps {
  variant?: AppInstallVariant;
  slug?: string;
  clinicName?: string;
  compact?: boolean;
  className?: string;
}

export function AppInstallCard({
  variant = "patient",
  slug,
  clinicName,
  compact = false,
  className,
}: AppInstallCardProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);

  const isClinic = variant === "clinic";
  const scope = isClinic ? "/" : slug ? `/portal/${slug}/` : "/";
  const title = isClinic
    ? "DrFlow consultorio"
    : clinicName
      ? `App ${clinicName}`
      : "App DrFlow para pacientes";
  const subtitle = isClinic
    ? "Instalá DrFlow en tu celular para acceder al dashboard, agenda y pacientes."
    : "Versión reducida: turnos, recetas y WhatsApp con el icono de DrFlow.";

  useEffect(() => {
    queueMicrotask(() => {
      setInstalled(isStandalone());
      setIosHint(isIos() && !isStandalone());
    });

    const path = window.location.pathname;
    const shouldRegister =
      (isClinic && (path.startsWith("/dashboard") || path.startsWith("/agenda"))) ||
      (!isClinic && slug && path.startsWith(`/portal/${slug}`));

    if (shouldRegister) {
      void registerServiceWorker(scope);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [isClinic, slug, scope]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  const handleDownloadIcon = () => {
    const anchor = document.createElement("a");
    anchor.href = "/icon-512.png";
    anchor.download = "DrFlow-icono.png";
    anchor.click();
  };

  if (installed) {
    return (
      <div
        className={cn(
          "rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-center",
          className
        )}
      >
        <DrFlowLogo size="sm" href={null} centered />
        <p className="mt-2 text-sm font-medium text-emerald-900">
          {isClinic ? "DrFlow instalado en tu celular" : "App instalada en tu celular"}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-white p-4 shadow-sm",
        compact && "p-3",
        className
      )}
    >
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left">
        <DrFlowLogo size={compact ? "xs" : "sm"} href={null} centered className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-950">{title}</p>
          {!compact && <p className="mt-1 text-xs leading-relaxed text-blue-800/80">{subtitle}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
        {deferredPrompt ? (
          <Button type="button" size="sm" onClick={handleInstall} disabled={installing}>
            <Smartphone className="h-4 w-4" />
            {installing ? "Instalando…" : "Instalar en celular"}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" disabled className="opacity-80">
            <Smartphone className="h-4 w-4" />
            Instalar en celular
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={handleDownloadIcon}>
          <Download className="h-4 w-4" />
          Descargar icono
        </Button>
        {!isClinic && slug && (
          <Link
            href={`/portal/${slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
          >
            Abrir portal
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
        <a
          href="/icon-512.png"
          download="DrFlow-icono.png"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
        >
          PNG directo
        </a>
      </div>

      {iosHint && (
        <p className="mt-3 rounded-lg bg-white/80 p-2 text-xs text-blue-900">
          <strong>iPhone:</strong> Safari → Compartir → Agregar a pantalla de inicio. Podés usar el
          icono descargado.
        </p>
      )}
      {!iosHint && !deferredPrompt && (
        <p className="mt-3 rounded-lg bg-white/80 p-2 text-xs text-blue-800/90">
          {isClinic ? (
            <>
              <strong>Android/Chrome:</strong> menú ⋮ → Instalar app.{" "}
              <strong>Desktop:</strong> icono en la barra de direcciones.
            </>
          ) : (
            <>
              <strong>Android:</strong> menú → Instalar app.{" "}
              <strong>iPhone:</strong> Compartir → Agregar a inicio.
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** @deprecated Usar AppInstallCard */
export function PatientAppInstallCard(
  props: Omit<AppInstallCardProps, "variant"> & { slug?: string }
) {
  return <AppInstallCard variant="patient" {...props} />;
}
