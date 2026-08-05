"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { logClientError } from "@/core/errors";
import { parseTrialDays, TRIAL_PROMO_DAYS } from "@/core/trial/clinic-trial";
import { parseDoctorSetupFromForm, validateDoctorSetup } from "@/core/validations/doctor-setup";
import { normalizeSlug, zodFieldErrors } from "@/core/validations/form-errors";
import { registerClinicSchema } from "@/core/validations/schemas";

import { setTrialRegistrationIntent, signUpClinic } from "@/lib/actions/auth";

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

export function useRegisterClinicForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTrial = parseTrialDays(searchParams.get("trial")) !== null;
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (isTrial) {
      void setTrialRegistrationIntent(TRIAL_PROMO_DAYS).catch((err) =>
        logClientError("register-clinic.trial-intent", err)
      );
    }
  }, [isTrial]);

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
      setFormError("No se pudo completar el registro. Si ya te registraste, probá iniciar sesión.");
    } catch (err) {
      logClientError("register-clinic.submit", err);
      setFormError("Error inesperado. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return {
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
  };
}
