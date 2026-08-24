import "server-only";

import { countActiveAutomationJobs } from "@/core/entitlements/automation-jobs.server";
import {
  commercialStatusLabel,
  effectiveCommercialStatus,
} from "@/core/entitlements/commercial-status";
import { getClinicEntitlements } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { countClinicSeatRows } from "@/core/entitlements/limits.server";
import {
  type CommercialQuotaRow,
  formatQuotaLabel,
} from "@/core/entitlements/quota-display";
import { lookupFeature } from "@/core/entitlements/resolve";
import { bytesToMb } from "@/core/entitlements/storage";
import { getClinicStorageBytes } from "@/core/entitlements/storage.server";
import { createClient } from "@/core/supabase/server";

export async function listCommercialQuotaRows(clinicId: string): Promise<CommercialQuotaRow[]> {
  const entitlements = await getClinicEntitlements({ clinicId });
  if (!entitlements.catalogAvailable) return [];

  const supabase = await createClient();
  const [patients, users, professionals, storageBytes, activeAutomations] = await Promise.all([
    countClinicSeatRows(supabase, FEATURES.PATIENTS_MAX, clinicId),
    countClinicSeatRows(supabase, FEATURES.USERS_MAX, clinicId),
    countClinicSeatRows(supabase, FEATURES.PROFESSIONALS_MAX, clinicId),
    getClinicStorageBytes(supabase, clinicId),
    countActiveAutomationJobs(supabase, clinicId),
  ]);

  const patientsLimit = lookupFeature(entitlements, FEATURES.PATIENTS_MAX)?.limit ?? 0;
  const usersLimit = lookupFeature(entitlements, FEATURES.USERS_MAX)?.limit ?? 0;
  const professionalsLimit = lookupFeature(entitlements, FEATURES.PROFESSIONALS_MAX)?.limit ?? 0;
  const aiLimit = lookupFeature(entitlements, FEATURES.AI_MONTHLY_REQUESTS)?.limit ?? 0;
  const whatsappLimit = lookupFeature(entitlements, FEATURES.WHATSAPP_MONTHLY_MESSAGES)?.limit ?? 0;
  const transcriptionsLimit =
    lookupFeature(entitlements, FEATURES.AI_MONTHLY_TRANSCRIPTIONS)?.limit ?? 0;

  const storageLimit = lookupFeature(entitlements, FEATURES.STORAGE_MAX_MB)?.limit ?? 0;
  const automationsLimit = lookupFeature(entitlements, FEATURES.AUTOMATIONS_MAX_ACTIVE)?.limit ?? 0;
  const statusLabel = commercialStatusLabel(
    effectiveCommercialStatus(entitlements.status, entitlements.trialEndsAt)
  );

  return [
    ...(statusLabel
      ? [{ label: "Estado comercial", value: `extras en pausa (${statusLabel})` }]
      : []),
    { label: "Pacientes", value: formatQuotaLabel(patients, patientsLimit) },
    { label: "Usuarios", value: formatQuotaLabel(users, usersLimit) },
    { label: "Profesionales", value: formatQuotaLabel(professionals, professionalsLimit) },
    {
      label: "IA (mes)",
      value: formatQuotaLabel(entitlements.usage[FEATURES.AI_MONTHLY_REQUESTS] ?? 0, aiLimit),
    },
    {
      label: "WhatsApp (mes)",
      value: formatQuotaLabel(
        entitlements.usage[FEATURES.WHATSAPP_MONTHLY_MESSAGES] ?? 0,
        whatsappLimit
      ),
    },
    {
      label: "Transcripciones (mes)",
      value: formatQuotaLabel(
        entitlements.usage[FEATURES.AI_MONTHLY_TRANSCRIPTIONS] ?? 0,
        transcriptionsLimit
      ),
    },
    ...(storageBytes === null
      ? []
      : [
          {
            label: "Almacenamiento",
            value: formatQuotaLabel(bytesToMb(storageBytes), storageLimit),
          },
        ]),
    ...(activeAutomations === null
      ? []
      : [
          {
            label: "Automatizaciones activas",
            value: formatQuotaLabel(activeAutomations, automationsLimit),
          },
        ]),
  ];
}
