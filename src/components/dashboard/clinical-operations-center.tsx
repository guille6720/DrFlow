"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClinicalOperationsPayload } from "@/lib/utils/clinical-operations-types";
import {
  ClinicalOpsCriticalPatientsCard,
  ClinicalOpsDraftPrescriptionsCard,
  ClinicalOpsNotificationsCard,
  ClinicalOpsOverdueCard,
  ClinicalOpsPendingStudiesCard,
  ClinicalOpsUpcomingCard,
  ClinicalOpsWaitingCard,
} from "@/components/dashboard/clinical-ops-cards";

type Props = {
  ops: ClinicalOperationsPayload;
  canManageAppointments: boolean;
};

export function ClinicalOperationsCenter({ ops, canManageAppointments }: Props) {
  return (
    <section aria-label="Centro de operaciones clínicas" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Centro de operaciones clínicas</h2>
          <p className="text-sm text-slate-500">Solo lo que requiere acción hoy</p>
        </div>
        <Link href="/sala-espera">
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4" />
            Sala de espera
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ClinicalOpsWaitingCard waiting={ops.waiting} />
        <ClinicalOpsUpcomingCard upcoming={ops.upcoming} canManageAppointments={canManageAppointments} />
        <ClinicalOpsOverdueCard overdue={ops.overdue} />
        <ClinicalOpsCriticalPatientsCard criticalPatients={ops.criticalPatients} />
        <ClinicalOpsDraftPrescriptionsCard draftPrescriptions={ops.draftPrescriptions} />
        <ClinicalOpsPendingStudiesCard pendingStudies={ops.pendingStudies} />
        <ClinicalOpsNotificationsCard notifications={ops.notifications} />
      </div>
    </section>
  );
}
