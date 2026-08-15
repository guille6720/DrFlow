import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { unwrapNestedRow } from "@/core/supabase/nested-row";
import { createClient } from "@/core/supabase/server";

import type { ProfessionalSignatureRow } from "@/features/profesionales/components/profesionales/professional-signatures-manager";
import { ProfessionalSignaturesManager } from "@/features/profesionales/components/profesionales/professional-signatures-manager";

import { getCachedClinicProfessionalsList } from "@/lib/server/cached-clinic-queries";
import { buildProfessionalSignature } from "@/lib/utils/professional";

export default async function FirmasPage() {
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!clinicId) {
    redirect("/login");
  }

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    redirect("/dashboard");
  }

  const canManageAll = hasPermission(role, "manageStaff", isSuperadmin);
  const supabase = await createClient();

  const cachedProfessionals = canManageAll
    ? await getCachedClinicProfessionalsList(clinicId)
    : await (async () => {
        let query = supabase
          .from("professionals")
          .select(
            "id, display_name, license_number, license_national, license_provincial, signature_text, signature_image_path, user_id, profiles(full_name)"
          )
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .order("display_name");

        if (profile?.id) {
          query = query.eq("user_id", profile.id);
        }

        const { data: professionals } = await query;
        const { resolveProfessionalSignatureUrls } = await import(
          "@/lib/server/resolve-professional-signature-urls"
        );
        return resolveProfessionalSignatureUrls(supabase, professionals ?? []);
      })();

  const rows: ProfessionalSignatureRow[] = cachedProfessionals.map((pro) => {
    const profileRow = unwrapNestedRow(
      pro.profiles as { full_name?: string } | { full_name?: string }[] | null
    );
    return {
      id: pro.id,
      display_name: pro.display_name,
      license_number: pro.license_number,
      license_national: pro.license_national ?? null,
      license_provincial: pro.license_provincial ?? null,
      signature_text: pro.signature_text?.trim() || buildProfessionalSignature(pro),
      signature_image_path: pro.signature_image_path,
      signature_image_url: pro.signature_image_url,
      profiles: profileRow?.full_name ? { full_name: String(profileRow.full_name) } : null,
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
