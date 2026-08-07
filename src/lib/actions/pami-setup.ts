"use server";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { revalidatePamiCabeceraSurfaces } from "@/core/cache/revalidate-pami-cabecera";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { createClient } from "@/core/supabase/server";

import {
  formatPamiCabeceraSuccessMessage,
  pamiCabeceraSeedChanged,
  parsePamiCabeceraSeedResult,
} from "@/features/pami/server/pami-cabecera-setup";

import { pamiSetupMessages } from "@/locales/es-AR/pami/setup";

export async function configurePamiCabecera(): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
  alreadyConfigured?: boolean;
  changed?: boolean;
}> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };
  const clinicId = access.clinicId;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("seed_pami_cabecera_for_clinic", {
    p_clinic_id: clinicId,
  });

  if (error) {
    return {
      error: resolvePostgresUserMessage(error, {
        fallback: pamiSetupMessages.seed.configureError,
      }),
    };
  }

  const result = parsePamiCabeceraSeedResult(data);
  const changed = pamiCabeceraSeedChanged(result);

  if (changed) {
    revalidatePamiCabeceraSurfaces(clinicId);
  }

  return {
    success: true,
    alreadyConfigured: result.already_configured === true,
    changed,
    message: formatPamiCabeceraSuccessMessage(result),
  };
}
