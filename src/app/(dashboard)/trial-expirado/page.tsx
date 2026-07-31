import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { getDashboardShell } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { isClinicTrialExpired, TRIAL_PROMO_DAYS } from "@/lib/trial/clinic-trial";

export default async function TrialExpiradoPage() {
  const { profile, clinic, isSuperadmin } = await getDashboardShell();

  if (!profile) redirect("/login");
  if (isSuperadmin || !isClinicTrialExpired(clinic)) {
    redirect("/dashboard");
  }

  return (
    <>
      <DashboardPageHeader
        title="Prueba finalizada"
        subtitle="Tu periodo de prueba de DrFlow terminó"
      />
      <div className="mx-auto max-w-lg space-y-6 p-4 sm:p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex justify-center">
            <CalendarX2 className="h-12 w-12 text-slate-400" aria-hidden />
          </div>
          <h1 className="text-center text-xl font-bold text-slate-900">
            Los {TRIAL_PROMO_DAYS} días de prueba terminaron
          </h1>
          <p className="mt-3 text-center text-sm text-slate-600">
            Tus datos del consultorio siguen guardados. Para seguir usando agenda, historias
            clínicas y recetas, contactanos para activar tu plan.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/configuracion">
              <Button type="button" className="w-full">
                Ir a configuración
              </Button>
            </Link>
            <Link href="/ayuda">
              <Button type="button" variant="outline" className="w-full">
                Ayuda / manual
              </Button>
            </Link>
            <form action="/api/auth/signout" method="post" className="mt-2">
              <Button type="submit" variant="ghost" className="w-full text-slate-600">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
