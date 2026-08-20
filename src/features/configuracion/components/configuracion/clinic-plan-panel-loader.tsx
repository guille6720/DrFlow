import { getActiveClinic, getActiveClinicId } from "@/core/auth/session.server";
import { loadClinicSubscriptionSummary } from "@/core/billing/subscription-service";
import {
  commercialStatusLabel,
  effectiveCommercialStatus,
} from "@/core/entitlements/commercial-status";
import { getClinicEntitlements } from "@/core/entitlements/entitlements.server";
import { listCommercialModuleAvailability } from "@/core/entitlements/module-summary";
import { listCommercialQuotaRows } from "@/core/entitlements/quota-summary.server";
import { toClientEntitlementsSnapshot } from "@/core/entitlements/resolve";

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

  const [summary, entitlements, commercialQuotas] = await Promise.all([
    loadClinicSubscriptionSummary(
      clinicId,
      clinic.name?.trim() || "Consultorio",
      clinic.trial_ends_at ?? null
    ),
    getClinicEntitlements(),
    listCommercialQuotaRows(clinicId),
  ]);

  return (
    <ClinicPlanPanel
      summary={summary}
      paymentNotice={paymentNotice}
      commercialPlanKey={entitlements.catalogAvailable ? entitlements.planKey : null}
      commercialStatus={
        entitlements.catalogAvailable
          ? commercialStatusLabel(
              effectiveCommercialStatus(entitlements.status, entitlements.trialEndsAt)
            )
          : null
      }
      commercialTrialEndsAt={entitlements.catalogAvailable ? entitlements.trialEndsAt : null}
      commercialQuotas={commercialQuotas}
      commercialModules={
        entitlements.catalogAvailable
          ? listCommercialModuleAvailability(toClientEntitlementsSnapshot(entitlements))
          : undefined
      }
    />
  );
}
