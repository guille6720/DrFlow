"use client";

import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/core/permissions/roles";
import type { TeamInvitation } from "@/lib/hooks/use-team-invite-panel";
import type { UserRole } from "@/types/database";
import { Mail, X } from "lucide-react";

type Props = {
  pending: TeamInvitation[];
  acting: string | null;
  runAction: (id: string, action: () => Promise<{ error?: string }>) => void;
  revokeClinicInvitation: (id: string) => Promise<{ error?: string }>;
};

export function TeamPendingInvitesSection({
  pending,
  acting,
  runAction,
  revokeClinicInvitation,
}: Props) {
  if (pending.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Mail className="h-4 w-4" />
        Invitaciones pendientes
      </h4>
      <ul className="space-y-2">
        {pending.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-slate-900">{inv.full_name}</p>
              <p className="text-xs text-slate-600">
                {inv.email} · {ROLE_LABELS[inv.role as UserRole] ?? inv.role}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={acting === inv.id}
              onClick={() => runAction(inv.id, () => revokeClinicInvitation(inv.id))}
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
