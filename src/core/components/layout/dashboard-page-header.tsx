import { getDashboardHeaderProps } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";

type DashboardPageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Stable Tutoriales NexClinic anchor (`data-tour`). */
  tourId?: string;
};

export async function DashboardPageHeader({ title, subtitle, tourId }: DashboardPageHeaderProps) {
  const header = await getDashboardHeaderProps();
  return (
    <Header
      title={title}
      subtitle={subtitle}
      tourId={tourId}
      clinics={header.clinics}
      activeClinicId={header.activeClinicId}
      role={header.role}
      userName={header.userName}
      isSuperadmin={header.isSuperadmin}
    />
  );
}
