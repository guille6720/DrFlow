"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PatientAppIcon } from "@/components/brand/patient-app-icon";
import { InstallStepWizard } from "@/components/portal/phone-install-guide";
import { Button } from "@/components/ui/button";
import { Copy, Smartphone } from "lucide-react";
import {
  isConsultorioStandalone,
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

/** Instalador visual estilo DrApp/Crontu — paso a paso con mockup de celular. */
export function PatientAppInstallView({ slug, clinicName, doctor }: Props) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios">("android");
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
      setPlatform(isIos() ? "ios" : "android");
      setInConsultorioApp(isConsultorioStandalone());
    });
  }, []);

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
    <div className="min-h-screen bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-900 px-4 py-8 text-white">
      <div className="mx-auto max-w-md space-y-6">
        {inConsultorioApp && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-500/20 p-4 text-sm leading-relaxed">
            <p className="font-semibold">Estás en la app azul del consultorio</p>
            <p className="mt-2 text-emerald-50">
              Abrí este link en <strong>Chrome</strong> para instalar la app verde de pacientes.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 w-full border-white/30 bg-white/10 text-white"
              onClick={() => void copyInstallLink()}
            >
              <Copy className="h-4 w-4" />
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
          </div>
        )}

        <div className="text-center">
          <div className="mx-auto mb-3 w-fit rounded-2xl bg-white p-3 shadow-lg">
            <PatientAppIcon size="md" priority />
          </div>
          <p className="text-sm font-medium text-emerald-200">DrFlow · Pacientes</p>
          <h1 className="mt-1 text-2xl font-bold">{doctor?.fullName ?? clinicName}</h1>
          {doctor?.licenseLabel && (
            <p className="text-sm text-emerald-100">{doctor.licenseLabel}</p>
          )}
          {doctor?.phone && (
            <p className="mt-2 text-xs text-emerald-200/80">
              {doctor.phone} — {PATIENT_CONTACT_PHONE_DISCLAIMER}
            </p>
          )}
        </div>

        {deferredPrompt && !inConsultorioApp ? (
          <Button
            type="button"
            size="lg"
            className="h-14 w-full gap-3 bg-white text-lg font-bold text-emerald-700 hover:bg-emerald-50"
            onClick={handleInstall}
            disabled={installing}
          >
            <Smartphone className="h-6 w-6" />
            {installing ? "Instalando…" : "Agregar a mi celular"}
          </Button>
        ) : (
          <InstallStepWizard platform={platform} onPlatformChange={setPlatform} />
        )}

        <Link
          href={portalUrl}
          className="block rounded-xl border border-white/25 py-3 text-center text-sm font-medium text-emerald-100 hover:bg-white/10"
        >
          Continuar en el navegador
        </Link>
      </div>
    </div>
  );
}
