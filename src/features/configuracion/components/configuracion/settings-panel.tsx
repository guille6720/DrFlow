"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ManageablePermissionKey } from "@/core/permissions/member-permissions";

import { SettingsAgendaSection } from "@/features/configuracion/components/configuracion/settings-agenda-section";
import { SettingsAppsSection } from "@/features/configuracion/components/configuracion/settings-apps-section";
import { SettingsClinicSection } from "@/features/configuracion/components/configuracion/settings-clinic-section";
import { TeamInvitePanel } from "@/features/configuracion/components/configuracion/team-invite-panel";

import type { TeamPermissionMember } from "@/lib/actions/team-permissions";
import type { Clinic } from "@/types/database";

export type SettingsSectionId = "clinica" | "apps" | "agenda" | "equipo";

interface SettingsPanelProps {
  section?: SettingsSectionId;
  clinic: Clinic | null;
  professionals: {
    id: string;
    display_name: string | null;
    license_number: string | null;
    profiles?: { full_name: string } | null;
    specialties?: { name: string } | null;
  }[];
  members: {
    id: string;
    role: string;
    is_active?: boolean;
    profiles?: { full_name: string; email: string } | null;
  }[];
  invitations: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    status: string;
    created_at: string;
  }[];
  bookingSlug: string | null;
  teamAccess?: {
    members: TeamPermissionMember[];
    permissionOverrides: Record<string, Partial<Record<ManageablePermissionKey, boolean>>>;
    hasSharedCredentials: boolean;
  };
}

export function SettingsPanel({
  section,
  clinic,
  professionals,
  members,
  invitations,
  bookingSlug,
  teamAccess,
}: SettingsPanelProps) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(action: () => Promise<{ error?: string; success?: boolean; slug?: string }>) {
    setMsg(null);
    setErr(null);
    const r = await action();
    if (r.error) setErr(r.error);
    else {
      setMsg(r.slug ? `Link activo: /solicitar-turno/${r.slug}` : "Guardado correctamente");
      router.refresh();
    }
  }

  if (!clinic) return <p className="text-sm text-slate-500">Sin clínica activa.</p>;

  const show = (part: SettingsSectionId) => !section || section === part;

  return (
    <div className="space-y-6">
      {msg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</div>
      ) : null}
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>
      ) : null}

      {show("clinica") ? <SettingsClinicSection clinic={clinic} onResult={run} /> : null}

      {show("apps") ? (
        <SettingsAppsSection clinic={clinic} bookingSlug={bookingSlug} onMessage={setMsg} />
      ) : null}

      {show("agenda") ? (
        <SettingsAgendaSection
          clinic={clinic}
          bookingSlug={bookingSlug}
          professionals={professionals}
          onResult={run}
          onMessage={setMsg}
        />
      ) : null}

      {show("equipo") ? (
        <>
          <TeamInvitePanel members={members} invitations={invitations} teamAccess={teamAccess} />
          <div className="drflow-card-light rounded-xl border border-slate-200 bg-white p-4">
            <Link href="/qa" className="text-sm font-medium text-blue-700 hover:underline">
              Abrir checklist QA interactivo →
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
