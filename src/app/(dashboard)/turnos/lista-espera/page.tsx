import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { type WaitingListRow, WaitingListView } from "@/features/turnos/components/waiting-list-view";

function normalizeWaitingListRows(raw: unknown[]): WaitingListRow[] {
  return raw.map((row) => {
    const entry = row as Record<string, unknown>;
    const patients = entry.patients;
    const professionals = entry.professionals;
    const specialties = entry.specialties;

    return {
      ...(entry as Omit<WaitingListRow, "patients" | "professionals" | "specialties">),
      patients: Array.isArray(patients) ? patients[0] ?? null : (patients as WaitingListRow["patients"]),
      professionals: Array.isArray(professionals)
        ? professionals[0] ?? null
        : (professionals as WaitingListRow["professionals"]),
      specialties: Array.isArray(specialties)
        ? specialties[0] ?? null
        : (specialties as WaitingListRow["specialties"]),
    };
  });
}

export default async function TurnosListaEsperaPage() {
  const ctx = await getDashboardPageContext();
  const { clinicId, role, isSuperadmin, permissionOverrides, clinics, profile } = ctx;

  if (!hasPermission(role, "manageAppointments", isSuperadmin, permissionOverrides)) {
    return (
      <>
        <Header
          title="Lista de espera"
          clinics={clinics}
          role={role}
          userName={profile?.full_name}
          isSuperadmin={isSuperadmin}
        />
        <p className="p-4 text-sm text-red-600">No tenés permiso para ver la lista de espera.</p>
      </>
    );
  }

  const supabase = await createClient();
  const { data: entries } = clinicId
    ? await supabase
        .from("waiting_list")
        .select(
          `id, status, notes, consultation_modality, preferred_date_from, preferred_date_to,
           preferred_time_from, preferred_time_to, created_at,
           patients(first_name, last_name, document_number, phone),
           professionals(display_name, profiles(full_name)),
           specialties(name)`
        )
        .eq("clinic_id", clinicId)
        .in("status", ["active", "contacted"])
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <>
      <Header
        title="Lista de espera"
        clinics={clinics}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />
      <div className="p-4">
        <WaitingListView entries={normalizeWaitingListRows(entries ?? [])} />
      </div>
    </>
  );
}
