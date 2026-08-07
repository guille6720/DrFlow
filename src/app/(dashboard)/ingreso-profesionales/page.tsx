import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import {
  type AvailabilityRuleRow,
  type ProfessionalIntakeDetail,
  ProfessionalIntakeView,
} from "@/features/profesionales";

import { enrichTeamMembers, filterSidebarInvitedMembers } from "@/lib/utils/team-member-display";

export default async function IngresoProfesionalesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; nuevo?: string; miembro?: string }>;
}) {
  const params = await searchParams;
  const { id: selectedId, nuevo, miembro: selectedMemberId } = params;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "manageStaff", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [
    { data: locations },
    { data: professionals },
    { data: rules },
    { data: members },
    { data: invitations },
  ] = clinicId
    ? await Promise.all([
        supabase
          .from("locations")
          .select("id, name, address")
          .eq("clinic_id", clinicId)
          .order("name"),
        supabase
          .from("professionals")
          .select(
            "id, display_name, document_number, email, phone, license_national, license_provincial, office_phone, office_address, accepted_insurances, intake_notes, intake_completed_at, location_id, tax_id, iva_status, bank_name, bank_account_type, bank_account_number, bank_cbu, bank_alias, specialties(name)"
          )
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .order("display_name"),
        supabase
          .from("availability_rules")
          .select("id, professional_id, day_of_week, start_time, end_time, slot_duration")
          .eq("clinic_id", clinicId)
          .eq("is_active", true),
        supabase
          .from("clinic_members")
          .select("id, role, is_active, user_id, professional_id, profiles(full_name, email)")
          .eq("clinic_id", clinicId)
          .order("created_at"),
        supabase
          .from("clinic_invitations")
          .select("id, email, full_name, status, initial_password")
          .eq("clinic_id", clinicId),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const professionalList: ProfessionalIntakeDetail[] = (professionals ?? []).map((p) => {
    const row = p as Record<string, unknown>;
    const spec = row.specialties;
    const specialty =
      spec && typeof spec === "object" && !Array.isArray(spec) && "name" in spec
        ? { name: String((spec as { name: string }).name) }
        : Array.isArray(spec) && spec[0] && typeof spec[0] === "object" && "name" in spec[0]
          ? { name: String((spec[0] as { name: string }).name) }
          : null;
    return {
      id: String(row.id),
      display_name: (row.display_name as string | null) ?? null,
      document_number: row.document_number as string | null | undefined,
      email: row.email as string | null | undefined,
      phone: row.phone as string | null | undefined,
      license_national: row.license_national as string | null | undefined,
      license_provincial: row.license_provincial as string | null | undefined,
      office_phone: row.office_phone as string | null | undefined,
      office_address: row.office_address as string | null | undefined,
      accepted_insurances: row.accepted_insurances as string | null | undefined,
      intake_notes: row.intake_notes as string | null | undefined,
      intake_completed_at: row.intake_completed_at as string | null | undefined,
      location_id: row.location_id as string | null | undefined,
      tax_id: row.tax_id as string | null | undefined,
      iva_status: row.iva_status as string | null | undefined,
      bank_name: row.bank_name as string | null | undefined,
      bank_account_type: row.bank_account_type as string | null | undefined,
      bank_account_number: row.bank_account_number as string | null | undefined,
      bank_cbu: row.bank_cbu as string | null | undefined,
      bank_alias: row.bank_alias as string | null | undefined,
      specialties: specialty,
    };
  });

  const teamMembers = enrichTeamMembers(members ?? [], invitations ?? []);
  const invitedMembers = filterSidebarInvitedMembers(teamMembers, professionalList);

  const scheduleByProfessional = ((rules ?? []) as AvailabilityRuleRow[]).reduce<
    Record<string, AvailabilityRuleRow[]>
  >((acc, rule) => {
    if (!acc[rule.professional_id]) acc[rule.professional_id] = [];
    acc[rule.professional_id].push(rule);
    return acc;
  }, {});

  if (!selectedId && !selectedMemberId && !nuevo && professionalList.length > 0) {
    redirect(`/ingreso-profesionales?id=${professionalList[0].id}`);
  }

  if (
    !selectedId &&
    !selectedMemberId &&
    !nuevo &&
    professionalList.length === 0 &&
    invitedMembers.length > 0
  ) {
    redirect(`/ingreso-profesionales?miembro=${invitedMembers[0].id}`);
  }

  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Cargando…</p>}>
      <ProfessionalIntakeView
        clinics={clinics}
        clinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        locations={locations ?? []}
        professionals={professionalList}
        teamMembers={teamMembers}
        invitedMembers={invitedMembers}
        scheduleByProfessional={scheduleByProfessional}
      />
    </Suspense>
  );
}
