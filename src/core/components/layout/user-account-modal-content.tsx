import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DoctorSetupFields,
} from "@/core/components/onboarding/doctor-setup-fields";
import type { useUserAccountModal } from "@/core/hooks/use-user-account-modal";
import { ROLE_LABELS } from "@/core/permissions/roles";
import { ExternalLink, Shield, UserCircle } from "lucide-react";

type ModalState = ReturnType<typeof useUserAccountModal>;

interface Props {
  modal: ModalState;
  onClose: () => void;
}

export function UserAccountModalContent({ modal, onClose }: Props) {
  if (modal.loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>;
  }

  return (
    <div className="space-y-5">
      {modal.formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {modal.formError}
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
            <dd className="font-medium text-slate-900">{modal.account?.fullName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="text-slate-800">{modal.account?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Rol en la clínica</dt>
            <dd className="mt-1">
              {modal.displayRole ? (
                <Badge variant="teal">{ROLE_LABELS[modal.displayRole]}</Badge>
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

      {modal.account && modal.account.accessibleModules.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2 text-slate-700">
            <Shield className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Módulos disponibles con tu rol</h3>
          </div>
          <ul className="flex flex-wrap gap-2">
            {modal.account.accessibleModules.map((m) => (
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

      {modal.account?.canManageStaff && (
        <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm">
          <p className="font-medium text-slate-900">Gestionar roles del equipo</p>
          <p className="mt-1 text-xs text-slate-600">
            Podés invitar usuarios como <strong>Médico</strong>,{" "}
            <strong>Secretaría / Recepción</strong> o <strong>Administrador</strong>.
          </p>
          <Link href="/configuracion?grupo=consultorio&seccion=equipo" onClick={onClose}>
            <Button type="button" size="sm" variant="outline" className="mt-3">
              <ExternalLink className="h-4 w-4" />
              Ir a Configuración → Equipo
            </Button>
          </Link>
        </section>
      )}

      {modal.account?.showProfessionalForm ? (
        <form key={modal.formKey} onSubmit={modal.handleSubmit} className="space-y-4 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">Datos profesionales (médico)</h3>
          <p className="text-xs text-slate-500">
            Aparecen en WhatsApp, portal de pacientes y documentos.
          </p>
          <DoctorSetupFields
            defaultValues={modal.defaults}
            fieldErrors={modal.fieldErrors}
            onClearError={modal.clearFieldError}
            showSectionTitle={false}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" loading={modal.pending}>
              Guardar cambios
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={modal.pending}>
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
  );
}
