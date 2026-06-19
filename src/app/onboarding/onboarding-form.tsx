"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { setupClinic } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setupClinicSchema } from "@/lib/validations/schemas";
import { normalizeSlug, zodFieldErrors } from "@/lib/validations/form-errors";
import { DrFlowLogo } from "@/components/brand/drflow-logo";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface OnboardingFormProps {
  userEmail: string;
  userName?: string;
}

export function OnboardingForm({ userEmail, userName }: OnboardingFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [slug, setSlug] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    const raw = {
      clinicName: String(new FormData(form).get("clinicName") ?? "").trim(),
      slug: normalizeSlug(slug || String(new FormData(form).get("slug") ?? "")),
      phone: String(new FormData(form).get("phone") ?? "").trim() || undefined,
    };

    const parsed = setupClinicSchema.safeParse(raw);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setFormError("Corregí los campos marcados en rojo.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData(form);
      formData.set("slug", parsed.data.slug);
      const result = await setupClinic(formData);

      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) {
        setFormError(result.error);
        return;
      }

      if (result.success && result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }

      setFormError("No se pudo completar. Intentá de nuevo.");
    } catch {
      setFormError("Error inesperado. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6 flex justify-center">
        <DrFlowLogo size="md" href="/" centered />
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          ¡Sesión iniciada como <strong>{userName ?? userEmail}</strong>! Solo falta
          crear tu clínica para entrar al panel.
        </span>
      </div>

      <h1 className="text-2xl font-bold text-slate-900">Completá tu acceso</h1>
      <p className="mt-1 text-sm text-slate-500">
        Último paso: datos de tu consultorio o centro médico.
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
          placeholder="Consultorio Dr. Castro"
          required
          error={fieldErrors.clinicName}
          onChange={() =>
            setFieldErrors((p) => {
              const n = { ...p };
              delete n.clinicName;
              return n;
            })
          }
        />

        <Input
          name="slug"
          label="Identificador URL (slug)"
          placeholder="consultorio-castro"
          required
          value={slug}
          error={fieldErrors.slug}
          onChange={(e) => {
            setSlug(normalizeSlug(e.target.value));
            setFieldErrors((p) => {
              const n = { ...p };
              delete n.slug;
              return n;
            });
          }}
        />

        <Input
          name="phone"
          label="Teléfono (opcional)"
          type="tel"
          error={fieldErrors.phone}
        />

        <Button type="submit" className="w-full" loading={loading}>
          Crear clínica e ingresar
        </Button>
      </form>
    </div>
  );
}
