"use client";

import { useState } from "react";
import { PatientAppIcon } from "@/components/brand/patient-app-icon";
import { cn } from "@/lib/utils/cn";
import { Share } from "lucide-react";

type Platform = "android" | "ios";

const STEPS: Record<
  Platform,
  { title: string; detail: string; highlight: "menu" | "install" | "icon" | "share" }[]
> = {
  android: [
    {
      title: "Abrí el menú ⋮",
      detail: "Arriba a la derecha en Chrome",
      highlight: "menu",
    },
    {
      title: "Tocá Instalar app",
      detail: "O «Agregar a pantalla de inicio»",
      highlight: "install",
    },
    {
      title: "Confirmá Instalar",
      detail: "Queda el icono verde «Pacientes»",
      highlight: "icon",
    },
  ],
  ios: [
    {
      title: "Tocá Compartir",
      detail: "El botón abajo en Safari",
      highlight: "share",
    },
    {
      title: "Agregar a inicio",
      detail: "Desplazá y elegí esa opción",
      highlight: "install",
    },
    {
      title: "Tocá Agregar",
      detail: "Icono verde «Pacientes» en tu pantalla",
      highlight: "icon",
    },
  ],
};

interface PhoneInstallGuideProps {
  platform: Platform;
  step: number;
}

/** Mockup de celular con pasos visuales (estilo tutoriales DrApp / Crontu). */
export function PhoneInstallGuide({ platform, step }: PhoneInstallGuideProps) {
  const steps = STEPS[platform];
  const current = steps[step];
  const highlight = current?.highlight;

  return (
    <div className="relative mx-auto w-[220px]">
      <div className="rounded-[2rem] border-[3px] border-slate-800 bg-slate-900 p-2 shadow-2xl">
        <div className="overflow-hidden rounded-[1.5rem] bg-white">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 text-[9px] text-slate-500">
            <span>16:16</span>
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="h-2 w-3 rounded-sm bg-slate-400" />
            </div>
          </div>

          {/* Browser chrome */}
          <div className="border-b border-slate-200 bg-slate-50 px-2 py-2">
            <div className="rounded-full bg-white px-2 py-1 text-center text-[8px] text-slate-400">
              drflow…/instalar
            </div>
            <div className="mt-1 flex justify-end gap-1">
              <div
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold transition",
                  highlight === "menu"
                    ? "bg-amber-400 text-slate-900 ring-2 ring-amber-300"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                ⋮
              </div>
            </div>
          </div>

          {/* App preview */}
          <div className="bg-gradient-to-b from-emerald-600 to-emerald-800 px-3 py-4 text-center">
            <div className="mx-auto mb-2 w-fit rounded-xl bg-white p-2">
              <PatientAppIcon size="sm" />
            </div>
            <p className="text-[9px] font-bold text-white">DrFlow</p>
            <p className="text-[8px] text-emerald-200">Pacientes</p>
          </div>

          {/* Action hint overlay */}
          {highlight === "install" && (
            <div className="border-t border-emerald-200 bg-emerald-50 px-2 py-2">
              <div className="rounded-lg bg-emerald-600 px-2 py-1.5 text-center text-[9px] font-bold text-white ring-2 ring-amber-400">
                {platform === "android" ? "Instalar app" : "Agregar a inicio"}
              </div>
            </div>
          )}

          {highlight === "share" && (
            <div className="flex justify-center border-t border-slate-200 bg-slate-50 py-2">
              <div className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[9px] font-semibold text-white ring-2 ring-amber-400">
                <Share className="h-3 w-3" />
                Compartir
              </div>
            </div>
          )}

          {highlight === "icon" && (
            <div className="grid grid-cols-4 gap-2 bg-slate-100 p-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-square rounded-xl bg-slate-300" />
              ))}
              <div className="aspect-square overflow-hidden rounded-xl ring-2 ring-amber-400">
                <PatientAppIcon size="sm" className="h-full w-full rounded-none" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step dots */}
      <div className="mt-3 flex justify-center gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === step ? "w-6 bg-white" : "w-1.5 bg-white/40"
            )}
          />
        ))}
      </div>
    </div>
  );
}

interface InstallStepWizardProps {
  platform: Platform;
  onPlatformChange: (p: Platform) => void;
}

export function InstallStepWizard({ platform, onPlatformChange }: InstallStepWizardProps) {
  const [step, setStep] = useState(0);
  const steps = STEPS[platform];

  return (
    <div className="w-full">
      <div className="mb-4 flex rounded-xl bg-white/10 p-1">
        <button
          type="button"
          onClick={() => {
            onPlatformChange("android");
            setStep(0);
          }}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition",
            platform === "android" ? "bg-white text-emerald-800" : "text-emerald-100"
          )}
        >
          Android
        </button>
        <button
          type="button"
          onClick={() => {
            onPlatformChange("ios");
            setStep(0);
          }}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition",
            platform === "ios" ? "bg-white text-emerald-800" : "text-emerald-100"
          )}
        >
          iPhone
        </button>
      </div>

      <PhoneInstallGuide platform={platform} step={step} />

      <div className="mt-5 rounded-2xl bg-white/10 p-4 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
          Paso {step + 1} de {steps.length}
        </p>
        <p className="mt-1 text-lg font-bold text-white">{steps[step].title}</p>
        <p className="mt-1 text-sm text-emerald-100">{steps[step].detail}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="flex-1 rounded-xl border border-white/30 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={step >= steps.length - 1}
          onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
          className="flex-1 rounded-xl bg-white py-2.5 text-sm font-bold text-emerald-800 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
