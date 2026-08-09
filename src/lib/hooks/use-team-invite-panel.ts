"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deactivateClinicMember,
  inviteClinicMember,
  removeClinicMemberPermanently,
  restoreClinicMemberLoginAccess,
  revokeClinicInvitation,
  updateClinicMemberRole,
} from "@/lib/actions/invitations";

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

  async function runAction(id: string, action: () => Promise<{ error?: string }>) {
    setActing(id);
    setErr(null);
    const result = await action();
    setActing(null);
    if (result.error) setErr(result.error);
    else router.refresh();
  }

  function handleRemoveMember(m: Member) {
    const name = m.display_name ?? m.profiles?.full_name ?? m.profiles?.email ?? "este usuario";
    if (
      !confirm(
        `¿Eliminar permanentemente a ${name}? Se borra la cuenta de acceso. Los registros clínicos históricos se conservan. También podés hacerlo desde Supabase → Authentication después de aplicar la migración 036.`
      )
    ) {
      return;
    }
    runAction(`${m.id}-remove`, () => removeClinicMemberPermanently(m.id));
  }

  const pending = invitations.filter((i) => i.status === "pending");
  const activeMembers = members.filter((m) => m.is_active !== false);

  return {
    loading,
    msg,
    err,
    acting,
    credentialsPath,
    handleInvite,
    runAction,
    handleRemoveMember,
    pending,
    activeMembers,
    updateClinicMemberRole,
    deactivateClinicMember,
    restoreClinicMemberLoginAccess,
    revokeClinicInvitation,
  };
}

export type { Invitation as TeamInvitation, Member as TeamMember };
