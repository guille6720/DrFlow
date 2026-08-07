"use client";

import type { ManageablePermissionKey } from "@/core/permissions/member-permissions";

import { CopyCredentialsLinkButton } from "@/features/configuracion/components/configuracion/copy-credentials-link-button";
import { TeamAccessPanel } from "@/features/configuracion/components/configuracion/team-access-panel";
import { TeamInviteFormSection } from "@/features/configuracion/components/configuracion/team-invite-form-section";
import { TeamMembersListSection } from "@/features/configuracion/components/configuracion/team-members-list-section";
import { TeamPendingInvitesSection } from "@/features/configuracion/components/configuracion/team-pending-invites-section";

import { Card } from "@/components/ui/card";
import type { TeamPermissionMember } from "@/lib/actions/team-permissions";
import { useTeamInvitePanel } from "@/lib/hooks/use-team-invite-panel";

interface Member {
  id: string;
  role: string;
  is_active?: boolean;
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

interface Props {
  members: Member[];
  invitations: Invitation[];
  teamAccess?: {
    members: TeamPermissionMember[];
    permissionOverrides: Record<string, Partial<Record<ManageablePermissionKey, boolean>>>;
    hasSharedCredentials: boolean;
  };
}

export function TeamInvitePanel({ members, invitations, teamAccess }: Props) {
  const panel = useTeamInvitePanel(members, invitations);

  return (
    <div id="equipo">
      <Card title="Equipo e invitaciones">
        <p className="mb-4 text-sm text-slate-700">
          Invitá médicos o secretaría por email. <strong>Desactivar</strong> suspende el acceso (no
          puede iniciar sesión). <strong>Eliminar cuenta</strong> borra el usuario de Auth.
        </p>

        {panel.msg && (
          <div className="mb-4 space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              {panel.msg}
            </div>
            {panel.credentialsPath ? (
              <CopyCredentialsLinkButton path={panel.credentialsPath} />
            ) : null}
          </div>
        )}
        {panel.err && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {panel.err}
          </div>
        )}

        <TeamInviteFormSection loading={panel.loading} onSubmit={panel.handleInvite} />
        <TeamMembersListSection
          activeMembers={panel.activeMembers}
          acting={panel.acting}
          runAction={panel.runAction}
          handleRemoveMember={panel.handleRemoveMember}
          updateClinicMemberRole={panel.updateClinicMemberRole}
          deactivateClinicMember={panel.deactivateClinicMember}
        />
        <TeamPendingInvitesSection
          pending={panel.pending}
          acting={panel.acting}
          runAction={panel.runAction}
          revokeClinicInvitation={panel.revokeClinicInvitation}
        />
      </Card>

      {teamAccess ? (
        <TeamAccessPanel
          members={teamAccess.members}
          permissionOverrides={teamAccess.permissionOverrides}
          hasSharedCredentials={teamAccess.hasSharedCredentials}
        />
      ) : null}
    </div>
  );
}
