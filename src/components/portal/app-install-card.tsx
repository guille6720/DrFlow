"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  isPatientPortalReady,
  isStandaloneMode,
  markPatientPortalReady,
} from "@/lib/utils/patient-portal-ready";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type AppInstallVariant = "clinic" | "patient";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
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
  /** En portal pacientes: ocultar tras instalar o descargar icono */
  portalMode?: boolean;
  onPortalReady?: () => void;
}

export function AppInstallCard({
  variant = "patient",
  slug,
  clinicName,
  compact = false,
  className,
  portalMode = false,
  onPortalReady,
}: AppInstallCardProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

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
      const ready = portalMode && slug ? isPatientPortalReady(slug) : false;
      setPortalReady(ready);
      setInstalled(isStandaloneMode());
      setIosHint(isIos() && !isStandaloneMode());
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
  }, [isClinic, slug, scope, portalMode]);

  const markReady = () => {
    if (portalMode && slug) {
      markPatientPortalReady(slug);
      setPortalReady(true);
      onPortalReady?.();
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        markReady();
      }
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
    if (portalMode) markReady();
  };

  if (portalMode && portalReady) {
    return null;
  }

  if (installed && portalMode) {
    return null;
  }

  if (installed) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-center",
          className
        )}
      >
        <DrFlowLogo size="sm" href={null} />
        <p className="mt-2 text-sm font-medium text-emerald-900">
          {isClinic ? "DrFlow instalado en tu celular" : "App instalada en tu celular"}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-4 shadow-sm",
        compact && "p-3",
        className
      )}
    >
      <div className="flex justify-center">
        <DrFlowLogo size={compact ? "xs" : "sm"} href={null} />
      </div>

      {!compact && (
        <div className="mt-3 space-y-1 text-center">
          <p className="break-words text-sm font-semibold text-blue-950">{title}</p>
          <p className="break-words text-xs leading-relaxed text-blue-800/80">{subtitle}</p>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {deferredPrompt ? (
          <Button
            type="button"
            size="sm"
            className="w-full justify-center"
            onClick={handleInstall}
            disabled={installing}
          >
            <Smartphone className="h-4 w-4 shrink-0" />
            {installing ? "Instalando…" : "Instalar en celular"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled
            className="w-full justify-center opacity-80"
          >
            <Smartphone className="h-4 w-4 shrink-0" />
            Instalar en celular
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full justify-center"
          onClick={handleDownloadIcon}
        >
          <Download className="h-4 w-4 shrink-0" />
          Descargar icono
        </Button>
        {!isClinic && slug && (
          <Link
            href={`/portal/${slug}`}
            target="_blank"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            Abrir portal
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </Link>
        )}
        <a
          href="/icon-512.png"
          download="DrFlow-icono.png"
          onClick={() => {
            if (portalMode) markReady();
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-slate-500 hover:text-blue-700"
        >
          PNG directo
        </a>
      </div>

      {iosHint && (
        <p className="mt-3 break-words rounded-lg bg-white/80 p-2 text-xs leading-relaxed text-blue-900">
          <strong>iPhone:</strong> Safari → Compartir → Agregar a pantalla de inicio.
        </p>
      )}
      {!iosHint && !deferredPrompt && (
        <p className="mt-3 break-words rounded-lg bg-white/80 p-2 text-xs leading-relaxed text-blue-800/90">
          {isClinic ? (
            <>
              <strong>Android/Chrome:</strong> menú → Instalar app.
              {" "}
              <strong>Desktop:</strong> icono en la barra de direcciones.
            </>
          ) : (
            <>
              <strong>Android:</strong> menú → Instalar app.
              {" "}
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
