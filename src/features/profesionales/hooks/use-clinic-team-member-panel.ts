"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deactivateClinicMember,
  removeClinicMemberPermanently,
  resendClinicMemberInviteEmail,
  updateClinicMemberPassword,
  updateClinicMemberProfile,
  updateClinicMemberRole,
} from "@/lib/actions/invitations";
import type { EnrichedTeamMember } from "@/lib/utils/team-member-display";
import type { UserRole } from "@/types/database";

export function useClinicTeamMemberPanel(member: EnrichedTeamMember | null) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
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

  async function handleSubmitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!member) return;
    setPasswordLoading(true);
    setError(null);
    setSuccess(null);
    const result = await updateClinicMemberPassword(member.id, new FormData(e.currentTarget));
    setPasswordLoading(false);
    if (result.error) setError(result.error);
    else {
      setSuccess(result.message ?? "Contraseña actualizada.");
      e.currentTarget.reset();
      router.refresh();
    }
  }

  async function handleResendInviteEmail() {
    if (!member) return;
    setResendLoading(true);
    setError(null);
    setSuccess(null);
    const result = await resendClinicMemberInviteEmail(member.id);
    setResendLoading(false);
    if (result.error) setError(result.error);
    else setSuccess(result.message ?? "Mail reenviado.");
  }

  async function runAction(id: string, action: () => Promise<{ error?: string; success?: boolean; message?: string }>) {
    setActing(id);
    setError(null);
    setSuccess(null);
    const result = await action();
    setActing(null);
    if (result.error) setError(result.error);
    else {
      if (result.message) setSuccess(result.message);
      router.refresh();
    }
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
    passwordLoading,
    resendLoading,
    acting,
    error,
    success,
    handleSubmitProfile,
    handleSubmitPassword,
    handleResendInviteEmail,
    handleRoleChange,
    handleDeactivate,
    handleRemove,
  };
}
