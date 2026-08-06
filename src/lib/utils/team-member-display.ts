type ProfileLike = { full_name?: string | null; email?: string | null } | null | undefined;

type InvitationLike = { email?: string | null; full_name?: string | null; status?: string | null };

export type EnrichedTeamMember = {
  id: string;
  role: string;
  is_active?: boolean;
  user_id?: string;
  professional_id?: string | null;
  profiles?: { full_name: string; email: string } | null;
  display_name: string;
  display_email: string | null;
};

function normalizeProfile(
  profiles: ProfileLike | ProfileLike[]
): { full_name: string; email: string } | null {
  if (!profiles) return null;
  const row = Array.isArray(profiles) ? profiles[0] : profiles;
  if (!row) return null;
  return {
    full_name: row.full_name?.trim() ?? "",
    email: row.email?.trim() ?? "",
  };
}

export function resolveMemberDisplayName(
  profile: ProfileLike | ProfileLike[],
  invitationNameByEmail: Map<string, string>,
  email?: string | null
): string {
  const normalized = normalizeProfile(profile);
  if (normalized?.full_name) return normalized.full_name;

  const lookupEmail = (email ?? normalized?.email ?? "").trim().toLowerCase();
  if (lookupEmail) {
    const invited = invitationNameByEmail.get(lookupEmail);
    if (invited) return invited;
  }

  if (normalized?.email) return normalized.email;
  if (lookupEmail) return lookupEmail;
  return "Sin nombre";
}

export function buildInvitationNameMap(
  invitations: InvitationLike[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const inv of invitations) {
    const email = inv.email?.trim().toLowerCase();
    const name = inv.full_name?.trim();
    if (!email || !name) continue;
    if (!map.has(email)) map.set(email, name);
  }
  return map;
}

type ProfessionalRef = { id: string; email?: string | null };

/** Miembros que solo deben listarse como invitados (no admins ni fichas ya cargadas arriba). */
export function filterSidebarInvitedMembers(
  members: EnrichedTeamMember[],
  professionals: ProfessionalRef[]
): EnrichedTeamMember[] {
  const professionalIds = new Set(professionals.map((p) => p.id));
  const professionalEmails = new Set(
    professionals
      .map((p) => p.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email))
  );

  return members.filter((member) => {
    if (member.is_active === false) return false;
    if (member.role === "clinic_admin") return false;
    if (member.professional_id && professionalIds.has(member.professional_id)) return false;

    const email = member.display_email?.trim().toLowerCase();
    if (email && professionalEmails.has(email)) return false;

    return true;
  });
}

export function enrichTeamMembers<
  T extends {
    id: string;
    role: string;
    is_active?: boolean;
    user_id?: string;
    professional_id?: string | null;
    profiles?: ProfileLike | ProfileLike[];
  },
>(members: T[], invitations: InvitationLike[]): Array<T & EnrichedTeamMember> {
  const invitationNameByEmail = buildInvitationNameMap(invitations);

  return members.map((member) => {
    const profiles = normalizeProfile(member.profiles);
    const display_email = profiles?.email ?? null;
    return {
      ...member,
      profiles,
      display_name: resolveMemberDisplayName(
        member.profiles,
        invitationNameByEmail,
        display_email
      ),
      display_email,
    };
  });
}
