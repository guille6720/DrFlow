import { createClient } from "@/core/supabase/server";

import type { ConfiguracionSectionExtras } from "@/features/configuracion/components/configuracion/configuracion-section-content";
import type { ConfiguracionSectionId } from "@/features/configuracion/components/configuracion/configuracion-sections";
import { loadCoverageRuleForKind } from "@/features/recetas/repositories/coverage-rules.repository";

import { getClinicFeatureFlagSettings } from "@/lib/actions/clinic-feature-flags";
import { getClinicJobsList } from "@/lib/actions/clinic-jobs";
import { getClinicPluginSettings } from "@/lib/actions/clinic-plugins";
import { getClinicObservabilityDashboard } from "@/lib/actions/observability";
import { loadPamiPlanillaAdminCatalog } from "@/lib/actions/pami-planilla-admin";

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
> = {
  pluginSettings: [],
  flagSettings: [],
  jobSettings: [],
  observability: undefined,
  pamiPlanillaAdminCatalog: undefined,
  pamiPlanillaAdminError: undefined,
  pamiCoverageRule: undefined,
  pamiCoverageRuleError: undefined,
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
    case "pami": {
      if (!clinicId) return EMPTY_EXTRAS;
      const [planillaResult, supabase] = await Promise.all([
        loadPamiPlanillaAdminCatalog(),
        createClient(),
      ]);
      const coverageRuleResult = await loadCoverageRuleForKind(supabase, clinicId, "PAMI");
      return {
        ...EMPTY_EXTRAS,
        pamiPlanillaAdminCatalog:
          planillaResult && "catalog" in planillaResult ? planillaResult.catalog : undefined,
        pamiPlanillaAdminError:
          planillaResult && "error" in planillaResult ? planillaResult.error : undefined,
        pamiCoverageRule: coverageRuleResult.ok ? coverageRuleResult.data : undefined,
        pamiCoverageRuleError: coverageRuleResult.ok ? undefined : coverageRuleResult.error,
      };
    }
    default:
      return EMPTY_EXTRAS;
  }
}
