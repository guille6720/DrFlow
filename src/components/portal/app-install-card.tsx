"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { PatientAppIcon } from "@/components/brand/patient-app-icon";
import { Button } from "@/components/ui/button";
import { ExternalLink, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  isPatientPortalReady,
  isStandaloneMode,
  markPatientPortalInstalled,
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

interface AppInstallCardProps {
  variant?: AppInstallVariant;
  slug?: string;
  clinicName?: string;
  compact?: boolean;
  className?: string;
  /** En portal pacientes: ocultar tras instalar la app */
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
  const [portalReady, setPortalReady] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);

  const isClinic = variant === "clinic";
  const title = isClinic
    ? "DrFlow consultorio"
    : clinicName
      ? `App ${clinicName}`
      : "App DrFlow para pacientes";
  const subtitle = isClinic
    ? "Agregá DrFlow a la pantalla de inicio para acceder al dashboard y la agenda."
    : "Agregá la app a la pantalla de inicio para pedir turnos, recetas y WhatsApp.";

  const markInstalled = useCallback(() => {
    if (portalMode && slug) {
      markPatientPortalInstalled(slug);
      setPortalReady(true);
      onPortalReady?.();
    }
  }, [portalMode, slug, onPortalReady]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        markInstalled();
      }
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt, markInstalled]);

  useEffect(() => {
    queueMicrotask(() => {
      const ready = portalMode && slug ? isPatientPortalReady(slug) : false;
      setPortalReady(ready);
      setIosHint(isIos() && !isStandaloneMode());
    });
  }, [portalMode, slug]);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (!portalMode || !deferredPrompt || !slug) return;
    if (isPatientPortalReady(slug)) return;

    let timer: number | undefined;
    try {
      const key = `drflow-auto-install-${slug}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      timer = window.setTimeout(() => {
        void handleInstall();
      }, 600);
    } catch {
      /* sessionStorage no disponible */
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [portalMode, deferredPrompt, slug, handleInstall]);

  if (portalMode && (portalReady || isStandaloneMode())) {
    return null;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border p-4 shadow-sm",
        isClinic
          ? "border-blue-200 bg-gradient-to-b from-blue-50 to-white"
          : "border-emerald-200 bg-gradient-to-b from-emerald-50 to-white",
        compact && "p-3",
        className
      )}
    >
      <div className="flex justify-center">
        {isClinic ? (
          <DrFlowLogo size={compact ? "xs" : "sm"} href={null} />
        ) : (
          <PatientAppIcon size={compact ? "sm" : "md"} />
        )}
      </div>

      {!compact && (
        <div className="mt-3 space-y-1 text-center">
          <p
            className={cn(
              "break-words text-sm font-semibold",
              isClinic ? "text-blue-950" : "text-emerald-950"
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "break-words text-xs leading-relaxed",
              isClinic ? "text-blue-800/80" : "text-emerald-800/80"
            )}
          >
            {subtitle}
          </p>
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
            {installing ? "Instalando…" : "Agregar a pantalla de inicio"}
          </Button>
        ) : (
          <p
            className={cn(
              "rounded-lg bg-white/90 p-3 text-center text-xs leading-relaxed",
              isClinic ? "text-blue-900" : "text-emerald-900"
            )}
          >
            {iosHint ? (
              <>
                <strong>iPhone:</strong> tocá{" "}
                <span className="font-semibold">Compartir</span> abajo en Safari y elegí{" "}
                <span className="font-semibold">Agregar a pantalla de inicio</span>.
              </>
            ) : isClinic ? (
              <>
                <strong>Android/Chrome:</strong> menú ⋮ →{" "}
                <span className="font-semibold">Instalar app</span> o{" "}
                <span className="font-semibold">Agregar a pantalla de inicio</span>.
              </>
            ) : (
              <>
                <strong>Android:</strong> menú →{" "}
                <span className="font-semibold">Instalar app</span>.
                {" "}
                <strong>iPhone:</strong> Compartir →{" "}
                <span className="font-semibold">Agregar a inicio</span>.
              </>
            )}
          </p>
        )}

        {!isClinic && slug && !portalMode && (
          <Link
            href={`/portal/${slug}/instalar`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Abrir instalador para pacientes
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </Link>
        )}
      </div>
    </div>
  );
}

/** @deprecated Usar AppInstallCard */
export function PatientAppInstallCard(
  props: Omit<AppInstallCardProps, "variant"> & { slug?: string }
) {
  return <AppInstallCard variant="patient" {...props} />;
}
