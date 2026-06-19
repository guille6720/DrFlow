"use client";

import { useEffect, useState } from "react";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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

async function registerPortalServiceWorker(scope: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope });
  } catch {
    /* Instalación nativa puede fallar sin SW; descarga de icono sigue disponible. */
  }
}

interface PatientAppInstallCardProps {
  slug?: string;
  clinicName?: string;
  compact?: boolean;
  className?: string;
}

export function PatientAppInstallCard({
  slug,
  clinicName,
  compact = false,
  className,
}: PatientAppInstallCardProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);

  const scope = slug ? `/portal/${slug}/` : "/";

  useEffect(() => {
    queueMicrotask(() => {
      setInstalled(isStandalone());
      setIosHint(isIos() && !isStandalone());
    });

    if (slug && window.location.pathname.startsWith("/portal/")) {
      void registerPortalServiceWorker(scope);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [slug, scope]);

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
          App instalada en tu celular
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-center",
        compact && "p-3",
        className
      )}
    >
      <DrFlowLogo size={compact ? "xs" : "sm"} href={null} centered />
      <p className="mt-2 text-sm font-medium text-blue-900">
        {clinicName ? `App ${clinicName}` : "App DrFlow para pacientes"}
      </p>
      {!compact && (
        <p className="mt-1 text-xs text-blue-700/80">
          Instalala en tu celular con el icono de DrFlow.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {deferredPrompt && (
          <Button
            type="button"
            size="sm"
            onClick={handleInstall}
            disabled={installing}
          >
            <Smartphone className="h-4 w-4" />
            {installing ? "Instalando…" : "Instalar en celular"}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={handleDownloadIcon}>
          <Download className="h-4 w-4" />
          Descargar icono
        </Button>
      </div>

      {iosHint && (
        <p className="mt-3 text-xs text-blue-800/90">
          iPhone: Safari → Compartir → <strong>Agregar a pantalla de inicio</strong>
          {" · "}usá el icono descargado si lo necesitás.
        </p>
      )}
      {!iosHint && !deferredPrompt && (
        <p className="mt-3 text-xs text-blue-700/80">
          Android: menú del navegador → Instalar app. También podés descargar el icono
          y agregarlo manualmente.
        </p>
      )}
    </div>
  );
}
