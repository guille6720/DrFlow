import { getDashboardShell } from "@/core/auth/session";
import type { ClinicMember, UserRole } from "@/types/database";

export type DashboardHeaderProps = {
  clinics: ClinicMember[];
  activeClinicId: string | null;
  role: UserRole | null;
  userName?: string;
  isSuperadmin: boolean;
};

/** Props comunes para `<Header />` (deduplicado vía React.cache en getDashboardShell). */
export async function getDashboardHeaderProps(): Promise<DashboardHeaderProps> {
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardShell();
  return {
    clinics,
    activeClinicId: clinicId,
    role,
    userName: profile?.full_name ?? undefined,
    isSuperadmin,
  };
}

/** Shell completo para páginas que también necesitan clínica activa en queries. */
export async function getDashboardPageContext() {
  return getDashboardShell();
}
