"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadMyUserAccount } from "@/lib/actions/user-account";
import { updateMyDoctorProfile } from "@/lib/actions/doctor-profile";
import { parseDoctorSetupFromForm, validateDoctorSetup } from "@/lib/validations/doctor-setup";
import { zodFieldErrors } from "@/lib/validations/form-errors";
import type { DoctorSetupDefaultValues } from "@/components/onboarding/doctor-setup-fields";
import type { UserRole } from "@/types/database";

type Options = {
  open: boolean;
  onClose: () => void;
  role: UserRole | null;
};

export function useUserAccountModal({ open, onClose, role: roleProp }: Options) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [account, setAccount] = useState<Awaited<ReturnType<typeof loadMyUserAccount>>["data"]>();
  const [defaults, setDefaults] = useState<DoctorSetupDefaultValues>({});
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setFormError(null);
        setFieldErrors({});
      }
    });

    loadMyUserAccount().then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setFormError(res.error ?? "No se pudieron cargar tus datos");
        return;
      }
      setAccount(res.data);
      const d = res.data.doctorProfile;
      if (d) {
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
      }
    });

    return () => {
      cancelled = true;
    };
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

  const displayRole = account?.role ?? roleProp;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!account?.showProfessionalForm) return;

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

  function clearFieldError(name: string) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  return {
    pending,
    loading,
    fieldErrors,
    formError,
    account,
    defaults,
    formKey,
    displayRole,
    handleSubmit,
    clearFieldError,
  };
}
