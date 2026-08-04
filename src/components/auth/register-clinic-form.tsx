"use client";

import Link from "next/link";
import { Suspense } from "react";
import { AccountDeletedCleanup } from "@/components/auth/account-deleted-cleanup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DoctorSetupFields } from "@/components/onboarding/doctor-setup-fields";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { LegalAcceptanceCheckbox } from "@/components/legal/legal-consent-fields";
import { AlertCircle } from "lucide-react";
import { TRIAL_PROMO_DAYS } from "@/lib/trial/clinic-trial";
import { cn } from "@/lib/utils/cn";
import { useRegisterClinicForm } from "@/lib/hooks/use-register-clinic-form";

export function RegisterClinicForm() {
  const {
    formRef,
    step,
    setStep,
    formError,
    fieldErrors,
    loading,
    slug,
    isTrial,
    handleSlugChange,
    clearFieldError,
    handleContinue,
    handleSubmit,
  } = useRegisterClinicForm();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex justify-center">
          <DrFlowLogo size="xl" href="/" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Registrar clínica</h1>
          <p className="mt-1 text-sm text-slate-500">
            Creá tu cuenta y configurá tu consultorio en dos pasos.
          </p>

          <Suspense fallback={null}>
            <AccountDeletedCleanup />
          </Suspense>

          {isTrial ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
              Estás entrando con la <strong>prueba gratuita de {TRIAL_PROMO_DAYS} días</strong>.
              Sin tarjeta para empezar.
            </div>
          ) : null}

          <div className="mt-4 flex gap-2 text-xs font-medium">
            <span
              className={cn(
                "rounded-full px-3 py-1",
                step === 1 ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"
              )}
            >
              1. Cuenta
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1",
                step === 2 ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"
              )}
            >
              2. Consultorio
            </span>
          </div>

          <div className="mt-6">
            <GoogleLoginButton trialDays={isTrial ? TRIAL_PROMO_DAYS : undefined} />
            <p className="mt-2 text-center text-xs text-slate-500">
              Con Google vas a completar el consultorio en el onboarding.
            </p>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">o con email</span>
            </div>
          </div>

          <form ref={formRef} method="post" onSubmit={handleSubmit} className="space-y-4" noValidate>
            {isTrial ? (
              <input type="hidden" name="trialDays" value={String(TRIAL_PROMO_DAYS)} />
            ) : null}
            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            ) : null}

            <div className={cn(step !== 1 && "hidden")}>
              <Input
                name="email"
                label="Email de acceso"
                type="email"
                required
                autoComplete="email"
                error={fieldErrors.email}
                aria-invalid={!!fieldErrors.email}
                onChange={() => clearFieldError("email")}
              />
              <Input
                name="password"
                label="Contraseña"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                error={fieldErrors.password}
                aria-invalid={!!fieldErrors.password}
                onChange={() => clearFieldError("password")}
                className="mt-4"
              />
              <p className="mt-1 text-xs text-slate-400">Mínimo 8 caracteres.</p>
              <Button type="button" className="mt-4 w-full" onClick={handleContinue}>
                Continuar
              </Button>
            </div>

            <div className={cn(step !== 2 && "hidden")}>
              <Input
                name="clinicName"
                label="Nombre de la clínica"
                required
                error={fieldErrors.clinicName}
                aria-invalid={!!fieldErrors.clinicName}
                onChange={() => clearFieldError("clinicName")}
              />
              <Input
                name="slug"
                label="Identificador URL (slug)"
                placeholder="mi-clinica-norte"
                required
                value={slug}
                error={fieldErrors.slug}
                aria-invalid={!!fieldErrors.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className="mt-4"
              />
              <p className="-mt-2 text-xs text-slate-400">
                Solo minúsculas, números y guiones. Se normaliza automáticamente.
              </p>
              <div className="mt-4">
                <DoctorSetupFields fieldErrors={fieldErrors} onClearError={clearFieldError} />
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <LegalAcceptanceCheckbox />
                {fieldErrors.legal_accepted ? (
                  <p className="mt-2 text-xs text-red-600">{fieldErrors.legal_accepted}</p>
                ) : null}
              </div>
              <div className="mt-4 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  Atrás
                </Button>
                <Button type="submit" className="flex-1" loading={loading}>
                  Crear cuenta y clínica
                </Button>
              </div>
            </div>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="text-blue-700 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
