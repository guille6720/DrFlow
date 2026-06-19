"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DoctorSetupFields,
  type DoctorSetupDefaultValues,
} from "@/components/onboarding/doctor-setup-fields";
import { loadMyDoctorProfile, updateMyDoctorProfile } from "@/lib/actions/doctor-profile";
import { parseDoctorSetupFromForm, validateDoctorSetup } from "@/lib/validations/doctor-setup";
import { zodFieldErrors } from "@/lib/validations/form-errors";

interface DoctorProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export function DoctorProfileModal({ open, onClose }: DoctorProfileModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [defaults, setDefaults] = useState<DoctorSetupDefaultValues>({});
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    loadMyDoctorProfile().then((res) => {
      setLoading(false);
      if (res.error || !res.data) {
        setFormError(res.error ?? "No se pudieron cargar tus datos");
        return;
      }
      const d = res.data;
      setEmail(d.email);
      setDefaults({
        doctorFirstName: d.doctorFirstName,
        doctorLastName: d.doctorLastName,
        documentNumber: d.documentNumber,
        phone: d.phone,
        specialtySelect: d.specialtySelect,
        specialtyCustom: d.specialtyCustom,
        licenseNational: d.licenseNational,
        licenseProvincial: d.licenseProvincial,
      });
      setFormKey((k) => k + 1);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const raw = parseDoctorSetupFromForm(new FormData(form));
    const validated = validateDoctorSetup(raw);

    if (validated.fieldErrors) {
      setFieldErrors(validated.fieldErrors);
      setFormError("Revisá los campos marcados");
      return;
    }
    if (validated.error) {
      setFieldErrors(zodFieldErrors(validated.error));
      setFormError("Revisá los campos marcados");
      return;
    }

    setFormError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateMyDoctorProfile(new FormData(form));
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        setFormError(result.error ?? "Revisá los campos marcados");
        return;
      }
      if (result.error) {
        setFormError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doctor-profile-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={onClose}
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-blue-100 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 id="doctor-profile-title" className="text-lg font-semibold text-slate-900">
              Mis datos profesionales
            </h2>
            <p className="text-xs text-slate-500">
              Aparecen en WhatsApp, portal pacientes y documentos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>
          ) : (
            <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {formError}
                </div>
              )}

              {email && (
                <p className="text-sm text-slate-500">
                  Email de acceso: <span className="font-medium text-slate-700">{email}</span>
                </p>
              )}

              <DoctorSetupFields
                defaultValues={defaults}
                fieldErrors={fieldErrors}
                onClearError={(name) =>
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next[name];
                    return next;
                  })
                }
                showSectionTitle={false}
              />

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" loading={pending}>
                  Guardar cambios
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
