import Link from "next/link";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getSession,
  getUserClinics,
} from "@/lib/auth/session";
import { Header } from "@/components/layout/header";
import { QaChecklistView } from "@/components/qa/qa-checklist-view";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";

export default async function QaPage() {
  const profile = await getProfile();
  const user = await getSession();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role } = await getActiveClinic();

  return (
    <>
      <Header
        title="Checklist QA"
        subtitle="Verificación manual del MVP antes de producción"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-900">
          <ClipboardCheck className="h-5 w-5 shrink-0" />
          <p className="flex-1">
            Marcá cada ítem al probarlo. Los links abren el módulo directamente.
          </p>
          <Link href="/configuracion">
            <Button type="button" variant="outline" size="sm">
              Configuración
            </Button>
          </Link>
        </div>
        <QaChecklistView userId={user?.id} />
      </div>
    </>
  );
}
