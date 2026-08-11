import { getActiveClinic, getActiveClinicId } from "@/core/auth/session.server";
import { loadClinicSubscriptionSummary } from "@/core/billing/subscription-service";

import { ClinicPlanPanel } from "@/features/configuracion/components/configuracion/clinic-plan-panel";

type Props = {
  paymentNotice?: "ok" | "error" | "pending" | null;
};

export async function ClinicPlanPanelLoader({ paymentNotice }: Props) {
  const clinicId = await getActiveClinicId();
  const { clinic } = await getActiveClinic();

  if (!clinicId || !clinic) {
    return (
      <p className="text-sm text-slate-500">Seleccioná un consultorio para ver el plan.</p>
    );
  }

  const summary = await loadClinicSubscriptionSummary(
    clinicId,
    clinic.name?.trim() || "Consultorio",
    clinic.trial_ends_at ?? null
  );

  return <ClinicPlanPanel summary={summary} paymentNotice={paymentNotice} />;
}
