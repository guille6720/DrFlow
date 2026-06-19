"use client";

import { useCallback, useEffect, useState } from "react";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";
import {
  isPatientPortalReady,
  isStandaloneMode,
  markPatientPortalInstalled,
} from "@/lib/utils/patient-portal-ready";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

interface Props {
  slug: string;
  clinicName: string;
}

/** Pantalla mínima para que pacientes PAMI instalen la app con un solo toque. */
export function PatientAppInstallView({ slug, clinicName }: Props) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  const portalUrl = `/portal/${slug}`;

  const markInstalled = useCallback(() => {
    markPatientPortalInstalled(slug);
    setInstalled(true);
  }, [slug]);

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
      setInstalled(isPatientPortalReady(slug) || isStandaloneMode());
      setIosHint(isIos() && !isStandaloneMode());
    });
  }, [slug]);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (installed || isStandaloneMode()) {
      window.location.replace(portalUrl);
    }
  }, [installed, portalUrl]);

  useEffect(() => {
    if (!deferredPrompt || isPatientPortalReady(slug)) return;

    let timer: number | undefined;
    try {
      const key = `drflow-auto-install-${slug}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      timer = window.setTimeout(() => {
        void handleInstall();
      }, 800);
    } catch {
      /* sessionStorage no disponible */
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [deferredPrompt, slug, handleInstall]);

  if (installed || isStandaloneMode()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-600 text-white">
        <p className="text-lg">Abriendo la app…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-600 to-blue-800 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 rounded-3xl bg-white p-6 shadow-xl">
          <DrFlowLogo size="lg" href={null} />
        </div>

        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          App de {clinicName}
        </h1>
        <p className="mt-3 text-lg text-blue-100">
          Pedí turnos y recetas PAMI desde tu celular
        </p>

        <div className="mt-10 w-full space-y-4">
          {deferredPrompt ? (
            <Button
              type="button"
              size="lg"
              className="h-16 w-full justify-center gap-3 bg-white text-xl font-bold text-blue-700 hover:bg-blue-50"
              onClick={handleInstall}
              disabled={installing}
            >
              <Smartphone className="h-7 w-7 shrink-0" />
              {installing ? "Instalando…" : "Agregar a mi celular"}
            </Button>
          ) : (
            <div className="rounded-2xl bg-white/10 p-5 text-left text-base leading-relaxed text-blue-50">
              {iosHint ? (
                <ol className="list-decimal space-y-3 pl-5">
                  <li>Tocá el botón <strong>Compartir</strong> abajo en Safari</li>
                  <li>Elegí <strong>Agregar a pantalla de inicio</strong></li>
                  <li>Tocá <strong>Agregar</strong></li>
                </ol>
              ) : (
                <ol className="list-decimal space-y-3 pl-5">
                  <li>
                    Tocá el menú <strong>⋮</strong> arriba a la derecha
                  </li>
                  <li>
                    Elegí <strong>Instalar app</strong> o{" "}
                    <strong>Agregar a pantalla de inicio</strong>
                  </li>
                  <li>Tocá <strong>Instalar</strong></li>
                </ol>
              )}
            </div>
          )}
        </div>

        <p className="mt-8 text-sm text-blue-200">
          Una vez instalada, el icono azul queda en tu pantalla de inicio
        </p>
      </div>
    </div>
  );
}
