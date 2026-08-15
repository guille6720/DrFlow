import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { ProfessionalIntakeView } from "@/features/profesionales";
import {
  loadProfessionalIntakeDetail,
  loadProfessionalIntakeSidebar,
} from "@/features/profesionales/server/load-professional-intake-page-data";

import { getCachedClinicLocations } from "@/lib/server/cached-clinic-queries";
import { enrichTeamMembers, filterSidebarInvitedMembers } from "@/lib/utils/team-member-display";

export default async function IngresoProfesionalesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; nuevo?: string; miembro?: string }>;
}) {
  const params = await searchParams;
  const { id: selectedId, nuevo, miembro: selectedMemberId } = params;
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "manageStaff", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [locations, sidebarProfessionals, { data: members }, { data: invitations }, selectedDetail] =
    clinicId
      ? await Promise.all([
          getCachedClinicLocations(clinicId),
          loadProfessionalIntakeSidebar(supabase, clinicId),
          supabase
            .from("clinic_members")
            .select("id, role, is_active, user_id, professional_id, profiles(full_name, email)")
            .eq("clinic_id", clinicId)
            .order("created_at"),
          supabase
            .from("clinic_invitations")
            .select("id, email, full_name, status, initial_password")
            .eq("clinic_id", clinicId),
          selectedId
            ? loadProfessionalIntakeDetail(supabase, clinicId, selectedId)
            : Promise.resolve({ professional: null, rules: [] }),
        ])
      : [[], [], { data: [] }, { data: [] }, { professional: null, rules: [] }];

  const teamMembers = enrichTeamMembers(members ?? [], invitations ?? []);
  const invitedMembers = filterSidebarInvitedMembers(teamMembers, sidebarProfessionals);

  if (!selectedId && !selectedMemberId && !nuevo && sidebarProfessionals.length > 0) {
    redirect(`/ingreso-profesionales?id=${sidebarProfessionals[0].id}`);
  }

  if (
    !selectedId &&
    !selectedMemberId &&
    !nuevo &&
    sidebarProfessionals.length === 0 &&
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
        sidebarProfessionals={sidebarProfessionals}
        initialSelectedProfessional={selectedDetail.professional}
        initialScheduleRules={selectedDetail.rules}
        teamMembers={teamMembers}
        invitedMembers={invitedMembers}
      />
    </Suspense>
  );
}
