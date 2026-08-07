import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";

export type InvitationCredentialsView = {
  id: string;
  email: string;
  full_name: string;
  initial_password: string;
  clinic_name: string | null;
};

function mapRow(
  row: {
    id: string;
    email: string;
    full_name: string;
    initial_password: string | null;
    status: string;
    clinics?: { name: string } | { name: string }[] | null;
  } | null
): InvitationCredentialsView | null {
  if (!row) return null;
  if (row.status === "revoked") return null;
  const password = row.initial_password?.trim();
  if (!password) return null;

  const clinic = row.clinics;
  const clinicName = Array.isArray(clinic) ? clinic[0]?.name : clinic?.name;

  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    initial_password: password,
    clinic_name: clinicName ?? null,
  };
}

export async function loadInvitationCredentialsById(
  invitationId: string
): Promise<InvitationCredentialsView | null> {
  if (!hasAdminClient()) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("clinic_invitations")
    .select("id, email, full_name, initial_password, status, clinics(name)")
    .eq("id", invitationId)
    .maybeSingle();

  return mapRow(data);
}

export async function findInvitationCredentialsByEmail(
  email: string
): Promise<InvitationCredentialsView | null> {
  if (!hasAdminClient()) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("clinic_invitations")
    .select("id, email, full_name, initial_password, status, clinics(name)")
    .ilike("email", normalized)
    .in("status", ["pending", "accepted"])
    .not("initial_password", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return mapRow(data);
}
