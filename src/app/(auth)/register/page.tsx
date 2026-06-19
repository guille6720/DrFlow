"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { signUpClinic } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerClinicSchema } from "@/lib/validations/schemas";
import { normalizeSlug, zodFieldErrors } from "@/lib/validations/form-errors";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { AlertCircle } from "lucide-react";

const FIELD_ORDER = [
  "clinicName",
  "slug",
  "fullName",
  "email",
  "password",
  "phone",
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
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

  function validateClient(form: HTMLFormElement): Record<string, string> | null {
    const raw = {
      clinicName: String(new FormData(form).get("clinicName") ?? "").trim(),
      slug: normalizeSlug(String(new FormData(form).get("slug") ?? "")),
      fullName: String(new FormData(form).get("fullName") ?? "").trim(),
      email: String(new FormData(form).get("email") ?? "").trim(),
      password: String(new FormData(form).get("password") ?? ""),
      phone: String(new FormData(form).get("phone") ?? "").trim() || undefined,
    };

    const parsed = registerClinicSchema.safeParse(raw);
    if (!parsed.success) {
      return zodFieldErrors(parsed.error);
    }
    return null;
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
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex justify-center">
          <DrFlowLogo size="xl" href="/" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Registrar clínica</h1>
          <p className="mt-1 text-sm text-slate-500">
            Creá tu cuenta y configurá tu consultorio en minutos.
          </p>

          <form
            ref={formRef}
            method="post"
            onSubmit={handleSubmit}
            className="mt-6 space-y-4"
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
            />
            <p className="-mt-2 text-xs text-slate-400">
              Solo minúsculas, números y guiones. Se normaliza automáticamente.
            </p>

            <Input
              name="fullName"
              label="Tu nombre completo"
              required
              error={fieldErrors.fullName}
              aria-invalid={!!fieldErrors.fullName}
              onChange={() => clearFieldError("fullName")}
            />

            <Input
              name="email"
              label="Email"
              type="email"
              required
              autoComplete="email"
              error={fieldErrors.email}
              aria-invalid={!!fieldErrors.email}
              onChange={() => clearFieldError("email")}
            />

            <Input
              name="phone"
              label="Teléfono (opcional)"
              type="tel"
              error={fieldErrors.phone}
              aria-invalid={!!fieldErrors.phone}
              onChange={() => clearFieldError("phone")}
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
            />
            <p className="-mt-2 text-xs text-slate-400">Mínimo 8 caracteres.</p>

            <Button type="submit" className="w-full" loading={loading}>
              Crear cuenta y clínica
            </Button>
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
