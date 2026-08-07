import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { unwrapNestedRow } from "@/core/supabase/nested-row";
import { createClient } from "@/core/supabase/server";

import type { ProfessionalSignatureRow } from "@/features/profesionales/components/profesionales/professional-signatures-manager";
import { ProfessionalSignaturesManager } from "@/features/profesionales/components/profesionales/professional-signatures-manager";

import { resolveProfessionalSignatureUrls } from "@/lib/server/resolve-professional-signature-urls";
import { buildProfessionalSignature } from "@/lib/utils/professional";

export default async function FirmasPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId) {
    redirect("/login");
  }

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const canManageAll = hasPermission(role, "manageStaff", isSuperadmin);

  let query = supabase
    .from("professionals")
    .select(
      "id, display_name, license_number, license_national, license_provincial, signature_text, signature_image_path, user_id, profiles(full_name)"
    )
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("display_name");

  if (!canManageAll && profile?.id) {
    query = query.eq("user_id", profile.id);
  }

  const { data: professionals } = await query;
  const withUrls = await resolveProfessionalSignatureUrls(supabase, professionals ?? []);

  const rows: ProfessionalSignatureRow[] = withUrls.map((pro) => {
    const profile = unwrapNestedRow(pro.profiles);
    return {
      id: pro.id,
      display_name: pro.display_name,
      license_number: pro.license_number,
      license_national: pro.license_national,
      license_provincial: pro.license_provincial,
      signature_text: pro.signature_text?.trim() || buildProfessionalSignature(pro),
      signature_image_path: pro.signature_image_path,
      signature_image_url: pro.signature_image_url,
      profiles: profile ? { full_name: profile.full_name } : null,
    };
  });

  return (
    <>
      <Header
        title="Firmas de profesionales"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-4 sm:p-6">
        <p className="mb-4 text-sm text-slate-700">
          Configurá la firma de cada médico una sola vez. Se usará automáticamente al emitir recetas,
          órdenes médicas y registrar evoluciones.
        </p>
        <ProfessionalSignaturesManager professionals={rows} canManageAll={canManageAll} />
      </div>
    </>
  );
}
