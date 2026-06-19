"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PatientAppIcon } from "@/components/brand/patient-app-icon";
import { Button } from "@/components/ui/button";
import { Copy, Smartphone } from "lucide-react";
import {
  isConsultorioStandalone,
  isPatientPortalReady,
  isPatientStandalone,
  markPatientPortalInstalled,
  PATIENT_CONTACT_PHONE_DISCLAIMER,
} from "@/lib/utils/patient-portal-ready";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";

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
  doctor?: DoctorShareInfo;
}

/** Pantalla de instalación de la app verde del paciente. */
export function PatientAppInstallView({ slug, clinicName, doctor }: Props) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [inConsultorioApp, setInConsultorioApp] = useState(false);
  const [copied, setCopied] = useState(false);

  const portalUrl = `/portal/${slug}`;
  const installPath = `/portal/${slug}/instalar`;

  const markInstalled = useCallback(() => {
    markPatientPortalInstalled(slug);
  }, [slug]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        markInstalled();
        window.location.replace(portalUrl);
      }
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt, markInstalled, portalUrl]);

  useEffect(() => {
    queueMicrotask(() => {
      setIosHint(isIos() && !isPatientStandalone(slug));
      setInConsultorioApp(isConsultorioStandalone());
    });
  }, [slug]);

  useEffect(() => {
    if (isPatientStandalone(slug)) {
      window.location.replace(portalUrl);
    }
  }, [slug, portalUrl]);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function copyInstallLink() {
    const url = `${window.location.origin}${installPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible */
    }
  }

  if (isPatientStandalone(slug)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-emerald-600 text-white">
        <p className="text-lg">Abriendo la app…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-600 to-emerald-800 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        {inConsultorioApp && (
          <div className="mb-6 w-full rounded-2xl border border-amber-300/40 bg-amber-500/20 p-4 text-left text-sm leading-relaxed text-amber-50">
            <p className="font-semibold text-white">Estás en la app azul del consultorio</p>
            <p className="mt-2">
              Para instalar la app <strong>verde</strong> del paciente, abrí este link en Chrome:
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              <li>Tocá ⋮ arriba a la derecha</li>
              <li>Elegí <strong>Abrir en Chrome</strong></li>
              <li>Desde Chrome, tocá <strong>Agregar a pantalla de inicio</strong></li>
            </ol>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-4 w-full border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => void copyInstallLink()}
            >
              <Copy className="h-4 w-4 shrink-0" />
              {copied ? "Link copiado" : "Copiar link de instalación"}
            </Button>
          </div>
        )}

        <div className="mb-8 rounded-3xl bg-white p-6 shadow-xl">
          <PatientAppIcon size="lg" priority />
        </div>

        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          {doctor?.fullName ?? `App de ${clinicName}`}
        </h1>
        {doctor?.licenseLabel && (
          <p className="mt-2 text-lg font-medium text-emerald-100">{doctor.licenseLabel}</p>
        )}
        {doctor?.specialty && (
          <p className="mt-1 text-base text-emerald-200">{doctor.specialty}</p>
        )}
        <p className="mt-3 text-lg text-emerald-100">
          Pedí turnos y recetas PAMI desde tu celular
        </p>
        {doctor?.phone && (
          <p className="mt-4 text-sm text-emerald-200/90">
            Tel. {doctor.phone} — {PATIENT_CONTACT_PHONE_DISCLAIMER}
          </p>
        )}

        <div className="mt-10 w-full space-y-4">
          {deferredPrompt && !inConsultorioApp ? (
            <Button
              type="button"
              size="lg"
              className="h-16 w-full justify-center gap-3 bg-white text-xl font-bold text-emerald-700 hover:bg-emerald-50"
              onClick={handleInstall}
              disabled={installing}
            >
              <Smartphone className="h-7 w-7 shrink-0" />
              {installing ? "Instalando…" : "Agregar a mi celular"}
            </Button>
          ) : (
            <div className="rounded-2xl bg-white/10 p-5 text-left text-base leading-relaxed text-emerald-50">
              {iosHint ? (
                <ol className="list-decimal space-y-3 pl-5">
                  <li>Tocá el botón <strong>Compartir</strong> abajo en Safari</li>
                  <li>Elegí <strong>Agregar a pantalla de inicio</strong></li>
                  <li>Tocá <strong>Agregar</strong> — queda el icono <strong>verde</strong></li>
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
                  <li>Tocá <strong>Instalar</strong> — icono verde en tu pantalla</li>
                </ol>
              )}
            </div>
          )}

          <Link
            href={portalUrl}
            className="block w-full rounded-xl border border-white/30 py-3 text-center text-sm font-medium text-emerald-100 hover:bg-white/10"
          >
            Continuar sin instalar
          </Link>
        </div>

        <p className="mt-8 text-sm text-emerald-200">
          Icono <strong>verde</strong> — distinto al azul del consultorio
        </p>
      </div>
    </div>
  );
}
