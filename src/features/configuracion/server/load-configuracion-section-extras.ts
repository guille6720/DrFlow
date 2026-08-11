import { createClient } from "@/core/supabase/server";

import type { ConfiguracionSectionExtras } from "@/features/configuracion/components/configuracion/configuracion-section-content";
import type { ConfiguracionSectionId } from "@/features/configuracion/components/configuracion/configuracion-sections";
import { loadActiveCoverageRulesForClinic } from "@/features/recetas/repositories/coverage-rules.repository";

import { getClinicFeatureFlagSettings } from "@/lib/actions/clinic-feature-flags";
import { getClinicJobsList } from "@/lib/actions/clinic-jobs";
import { getClinicPluginSettings } from "@/lib/actions/clinic-plugins";
import { getClinicObservabilityDashboard } from "@/lib/actions/observability";
import { loadPamiPlanillaAdminCatalog } from "@/lib/actions/pami-planilla-admin";
import { listClinicApiKeys } from "@/lib/actions/public-api-keys";
import { getRefepsClinicSettings } from "@/lib/actions/refeps";

const EMPTY_EXTRAS: Pick<
  ConfiguracionSectionExtras,
  | "pluginSettings"
  | "flagSettings"
  | "jobSettings"
  | "observability"
  | "pamiPlanillaAdminCatalog"
  | "pamiPlanillaAdminError"
  | "pamiCoverageRule"
  | "pamiCoverageRuleError"
  | "prescriptionCoverageRules"
  | "prescriptionCoverageRulesError"
  | "refepsSettings"
  | "refepsSettingsError"
  | "apiPublicKeys"
> = {
  pluginSettings: [],
  flagSettings: [],
  jobSettings: [],
  observability: undefined,
  pamiPlanillaAdminCatalog: undefined,
  pamiPlanillaAdminError: undefined,
  pamiCoverageRule: undefined,
  pamiCoverageRuleError: undefined,
  prescriptionCoverageRules: undefined,
  prescriptionCoverageRulesError: undefined,
  refepsSettings: undefined,
  refepsSettingsError: undefined,
  apiPublicKeys: undefined,
};

/** Loads heavy configuracion panels only for the active section. */
export async function loadConfiguracionSectionExtras(
  activeSection: ConfiguracionSectionId | undefined,
  clinicId: string | null
): Promise<typeof EMPTY_EXTRAS> {
  if (!activeSection) return EMPTY_EXTRAS;

  switch (activeSection) {
    case "plugins": {
      const result = await getClinicPluginSettings();
      return { ...EMPTY_EXTRAS, pluginSettings: result.data ?? [] };
    }
    case "flags": {
      const result = await getClinicFeatureFlagSettings();
      return { ...EMPTY_EXTRAS, flagSettings: result.data ?? [] };
    }
    case "jobs": {
      const result = await getClinicJobsList();
      return { ...EMPTY_EXTRAS, jobSettings: result.data ?? [] };
    }
    case "observabilidad": {
      const result = await getClinicObservabilityDashboard();
      return { ...EMPTY_EXTRAS, observability: result.data };
    }
    case "coberturas": {
      if (!clinicId) return EMPTY_EXTRAS;
      const supabase = await createClient();
      const [rulesResult, refepsResult] = await Promise.all([
        loadActiveCoverageRulesForClinic(supabase, clinicId),
        getRefepsClinicSettings(),
      ]);
      return {
        ...EMPTY_EXTRAS,
        prescriptionCoverageRules: rulesResult.ok ? rulesResult.data : undefined,
        prescriptionCoverageRulesError: rulesResult.ok ? undefined : rulesResult.error,
        refepsSettings: "data" in refepsResult ? refepsResult.data : undefined,
        refepsSettingsError: "error" in refepsResult ? refepsResult.error : undefined,
      };
    }
    case "pami": {
      if (!clinicId) return EMPTY_EXTRAS;
      const planillaResult = await loadPamiPlanillaAdminCatalog();
      return {
        ...EMPTY_EXTRAS,
        pamiPlanillaAdminCatalog:
          planillaResult && "catalog" in planillaResult ? planillaResult.catalog : undefined,
        pamiPlanillaAdminError:
          planillaResult && "error" in planillaResult ? planillaResult.error : undefined,
      };
    }
    case "api-publica": {
      if (!clinicId) return EMPTY_EXTRAS;
      const keys = await listClinicApiKeys(clinicId);
      return { ...EMPTY_EXTRAS, apiPublicKeys: keys };
    }
    default:
      return EMPTY_EXTRAS;
  }
}
