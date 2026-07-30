"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, UserCircle, Shield, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DoctorSetupFields,
  type DoctorSetupDefaultValues,
} from "@/components/onboarding/doctor-setup-fields";
import { loadMyUserAccount } from "@/lib/actions/user-account";
import { updateMyDoctorProfile } from "@/lib/actions/doctor-profile";
import { parseDoctorSetupFromForm, validateDoctorSetup } from "@/lib/validations/doctor-setup";
import { zodFieldErrors } from "@/lib/validations/form-errors";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { UserRole } from "@/types/database";

interface UserAccountModalProps {
  open: boolean;
  onClose: () => void;
  role: UserRole | null;
}

export function UserAccountModal({ open, onClose, role: roleProp }: UserAccountModalProps) {
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

  if (!open) return null;

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

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-account-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={onClose}
      />

      <div className="relative flex min-h-full items-start justify-center p-4 py-8 sm:items-center sm:py-10">
        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id="user-account-title" className="text-lg font-semibold text-slate-900">
                Mi cuenta
              </h2>
              <p className="text-xs text-slate-500">
                {account?.clinicName ? account.clinicName : "Datos de acceso y permisos"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-5">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>
            ) : (
              <div className="space-y-5">
                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {formError}
                  </div>
                )}

                <section className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-teal-800">
                    <UserCircle className="h-5 w-5" />
                    <span className="text-sm font-semibold">Usuario logueado</span>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Nombre</dt>
                      <dd className="font-medium text-slate-900">{account?.fullName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
                      <dd className="text-slate-800">{account?.email ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Rol en la clínica</dt>
                      <dd className="mt-1">
                        {displayRole ? (
                          <Badge variant="teal">{ROLE_LABELS[displayRole]}</Badge>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-slate-600">
                    <strong>Caja</strong> y <strong>Sala de espera</strong> son módulos del menú lateral, no
                    roles. Para que otra persona use solo secretaría/caja, invitala como{" "}
                    <em>Secretaría / Recepción</em> desde Configuración.
                  </p>
                </section>

                {account && account.accessibleModules.length > 0 && (
                  <section>
                    <div className="mb-2 flex items-center gap-2 text-slate-700">
                      <Shield className="h-4 w-4" />
                      <h3 className="text-sm font-semibold">Módulos disponibles con tu rol</h3>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                      {account.accessibleModules.map((m) => (
                        <li key={m.href}>
                          <Link
                            href={m.href}
                            onClick={onClose}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                          >
                            {m.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {account?.canManageStaff && (
                  <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm">
                    <p className="font-medium text-slate-900">Gestionar roles del equipo</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Podés invitar usuarios como <strong>Médico</strong>,{" "}
                      <strong>Secretaría / Recepción</strong> o <strong>Administrador</strong>.
                    </p>
                    <Link href="/configuracion" onClick={onClose}>
                      <Button type="button" size="sm" variant="outline" className="mt-3">
                        <ExternalLink className="h-4 w-4" />
                        Ir a Configuración → Equipo
                      </Button>
                    </Link>
                  </section>
                )}

                {account?.showProfessionalForm ? (
                  <form key={formKey} onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 pt-4">
                    <h3 className="text-sm font-semibold text-slate-900">Datos profesionales (médico)</h3>
                    <p className="text-xs text-slate-500">
                      Aparecen en WhatsApp, portal de pacientes y documentos.
                    </p>
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
                ) : (
                  <div className="flex justify-end border-t border-slate-100 pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                      Cerrar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
