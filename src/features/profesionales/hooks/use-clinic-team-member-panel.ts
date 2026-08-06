"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deactivateClinicMember,
  removeClinicMemberPermanently,
  updateClinicMemberProfile,
  updateClinicMemberRole,
} from "@/lib/actions/invitations";
import type { EnrichedTeamMember } from "@/lib/utils/team-member-display";
import type { UserRole } from "@/types/database";

export function useClinicTeamMemberPanel(member: EnrichedTeamMember | null) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmitProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!member) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await updateClinicMemberProfile(member.id, new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setSuccess(result.message ?? "Datos actualizados.");
      router.refresh();
    }
  }

  async function runAction(id: string, action: () => Promise<{ error?: string }>) {
    setActing(id);
    setError(null);
    setSuccess(null);
    const result = await action();
    setActing(null);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  function handleRoleChange(role: UserRole) {
    if (!member) return;
    runAction(`${member.id}-role`, () => updateClinicMemberRole(member.id, role));
  }

  function handleDeactivate() {
    if (!member) return;
    if (!confirm(`¿Desactivar el acceso de ${member.display_name}?`)) return;
    runAction(`${member.id}-deactivate`, () => deactivateClinicMember(member.id));
  }

  function handleRemove() {
    if (!member) return;
    if (
      !confirm(
        `¿Eliminar permanentemente a ${member.display_name}? Se borra la cuenta de acceso. Los registros clínicos históricos se conservan.`
      )
    ) {
      return;
    }
    runAction(`${member.id}-remove`, () => removeClinicMemberPermanently(member.id));
  }

  return {
    loading,
    acting,
    error,
    success,
    handleSubmitProfile,
    handleRoleChange,
    handleDeactivate,
    handleRemove,
  };
}
