import { Header } from "@/core/components/layout/header";
import { getDashboardHeaderProps } from "@/core/auth/dashboard-page";

type DashboardPageHeaderProps = {
  title: string;
  subtitle?: string;
};

export async function DashboardPageHeader({ title, subtitle }: DashboardPageHeaderProps) {
  const header = await getDashboardHeaderProps();
  return (
    <Header
      title={title}
      subtitle={subtitle}
      clinics={header.clinics}
      activeClinicId={header.activeClinicId}
      role={header.role}
      userName={header.userName}
      isSuperadmin={header.isSuperadmin}
    />
  );
}
