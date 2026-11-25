"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  inviteClinicMember,
  restoreClinicMemberLoginAccess,
  revokeClinicInvitation,
  updateClinicMemberRole,
} from "@/lib/actions/invitations";
import {
  deactivateClinicMemberLifecycle,
  permanentlyDeleteClinicUserLifecycle,
  reactivateClinicMemberLifecycle,
  unlinkClinicMemberLifecycle,
} from "@/lib/actions/user-lifecycle";

interface Member {
  id: string;
  role: string;
  is_active?: boolean;
  display_name?: string;
  display_email?: string | null;
  profiles?: { full_name: string; email: string } | null;
}

interface Invitation {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
}

export function useTeamInvitePanel(members: Member[], invitations: Invitation[]) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [credentialsPath, setCredentialsPath] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);
    setCredentialsPath(null);
    const result = await inviteClinicMember(new FormData(e.currentTarget));
    setLoading(false);
    if ("error" in result) {
      setErr(result.error);
    } else {
      setMsg(result.message ?? "Invitación enviada.");
      setCredentialsPath(result.credentialsPath ?? null);
      e.currentTarget.reset();
      router.refresh();
    }
  }

  async function runAction(
    id: string,
    action: () => Promise<{ error?: string; message?: string; success?: boolean }>
  ) {
    setActing(id);
    setErr(null);
    const result = await action();
    setActing(null);
    if (result.error) setErr(result.error);
    else {
      if (result.message) setMsg(result.message);
      router.refresh();
    }
  }

  function handleRemoveMember(m: Member) {
    const name = m.display_name ?? m.profiles?.full_name ?? m.profiles?.email ?? "este usuario";
    const email = m.display_email ?? m.profiles?.email ?? "";
    if (
      !confirm(
        `¿Eliminar DEFINITIVAMENTE a ${name}?\n\nSe borra la cuenta de acceso y se libera el correo ${email} para futuros registros.\nLa ficha profesional, historias clínicas y auditorías se conservan.\nNo se eliminan pacientes ni datos de otros usuarios.`
      )
    ) {
      return;
    }
    const typed = window.prompt(`Para confirmar, escribí el email exacto:\n${email}`);
    if (!typed) return;
    runAction(`${m.id}-remove`, () => permanentlyDeleteClinicUserLifecycle(m.id, undefined, typed));
  }

  function handleUnlinkMember(m: Member) {
    const name = m.display_name ?? m.profiles?.full_name ?? m.profiles?.email ?? "este usuario";
    if (
      !confirm(
        `¿Desvincular a ${name} de esta clínica?\nLa cuenta Auth no se borra. La historia clínica se conserva.`
      )
    ) {
      return;
    }
    runAction(`${m.id}-unlink`, () => unlinkClinicMemberLifecycle(m.id));
  }

  const pending = invitations.filter((i) => i.status === "pending");
  const activeMembers = members.filter((m) => m.is_active !== false);
  const inactiveMembers = members.filter((m) => m.is_active === false);

  return {
    loading,
    msg,
    err,
    acting,
    credentialsPath,
    handleInvite,
    runAction,
    handleRemoveMember,
    handleUnlinkMember,
    pending,
    activeMembers,
    inactiveMembers,
    updateClinicMemberRole,
    deactivateClinicMember: deactivateClinicMemberLifecycle,
    reactivateClinicMember: reactivateClinicMemberLifecycle,
    restoreClinicMemberLoginAccess,
    revokeClinicInvitation,
  };
}

export type { Invitation as TeamInvitation, Member as TeamMember };
