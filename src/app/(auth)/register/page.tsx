"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { signUpClinic } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerClinicSchema } from "@/lib/validations/schemas";
import { parseDoctorSetupFromForm, validateDoctorSetup } from "@/lib/validations/doctor-setup";
import { normalizeSlug, zodFieldErrors } from "@/lib/validations/form-errors";
import { DoctorSetupFields } from "@/components/onboarding/doctor-setup-fields";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const FIELD_ORDER = [
  "email",
  "password",
  "clinicName",
  "slug",
  "doctorFirstName",
  "doctorLastName",
  "documentNumber",
  "phone",
  "specialtySelect",
  "specialtyCustom",
  "licenseNational",
  "licenseProvincial",
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [slug, setSlug] = useState("");

  function scrollToFirstError(errors: Record<string, string>) {
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (!first) return;
    const el = formRef.current?.querySelector(`[name="${first}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  }

  function validateStep1(form: HTMLFormElement): Record<string, string> | null {
    const formData = new FormData(form);
    const parsed = registerClinicSchema
      .pick({ email: true, password: true })
      .safeParse({
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      });
    if (!parsed.success) return zodFieldErrors(parsed.error);
    return null;
  }

  function validateClient(form: HTMLFormElement): Record<string, string> | null {
    const formData = new FormData(form);
    const accountParsed = registerClinicSchema.safeParse({
      clinicName: String(formData.get("clinicName") ?? "").trim(),
      slug: normalizeSlug(String(formData.get("slug") ?? "")),
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });

    const doctorResult = validateDoctorSetup(parseDoctorSetupFromForm(formData));

    const errors: Record<string, string> = {};
    if (!accountParsed.success) Object.assign(errors, zodFieldErrors(accountParsed.error));
    if (doctorResult.fieldErrors) Object.assign(errors, doctorResult.fieldErrors);
    if (doctorResult.error) Object.assign(errors, zodFieldErrors(doctorResult.error));

    return Object.keys(errors).length > 0 ? errors : null;
  }

  function handleSlugChange(value: string) {
    setSlug(normalizeSlug(value));
    if (fieldErrors.slug) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.slug;
        return next;
      });
    }
  }

  function clearFieldError(name: string) {
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (formError) setFormError(null);
  }

  function handleContinue(e: React.MouseEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    setFormError(null);
    const stepErrors = validateStep1(form);
    if (stepErrors) {
      setFieldErrors(stepErrors);
      setFormError("Completá email y contraseña (mín. 8 caracteres).");
      scrollToFirstError(stepErrors);
      return;
    }
    setFieldErrors({});
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    const clientErrors = validateClient(form);
    if (clientErrors) {
      setFieldErrors(clientErrors);
      setFormError("Corregí los campos marcados en rojo antes de continuar.");
      if (clientErrors.email || clientErrors.password) setStep(1);
      else setStep(2);
      scrollToFirstError(clientErrors);
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData(form);
      formData.set("slug", normalizeSlug(slug || String(formData.get("slug") ?? "")));

      const result = await signUpClinic(formData);

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        scrollToFirstError(result.fieldErrors);
      }

      if (result.error) {
        setFormError(result.error);
        return;
      }

      if (result.success && result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }

      setFormError(
        "No se pudo completar el registro. Si ya te registraste, probá iniciar sesión."
      );
    } catch {
      setFormError("Error inesperado. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

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
            <GoogleLoginButton />
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

          <form
            ref={formRef}
            method="post"
            onSubmit={handleSubmit}
            className="space-y-4"
            noValidate
          >
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

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
                <DoctorSetupFields
                  fieldErrors={fieldErrors}
                  onClearError={clearFieldError}
                />
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
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
