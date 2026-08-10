import type { ConfiguracionSectionExtras } from "@/features/configuracion/components/configuracion/configuracion-section-content";
import type { ConfiguracionSectionId } from "@/features/configuracion/components/configuracion/configuracion-sections";

import { getClinicFeatureFlagSettings } from "@/lib/actions/clinic-feature-flags";
import { getClinicJobsList } from "@/lib/actions/clinic-jobs";
import { getClinicPluginSettings } from "@/lib/actions/clinic-plugins";
import { getClinicObservabilityDashboard } from "@/lib/actions/observability";
import { loadPamiPlanillaAdminCatalog } from "@/lib/actions/pami-planilla-admin";

const EMPTY_EXTRAS: Pick<
  ConfiguracionSectionExtras,
  "pluginSettings" | "flagSettings" | "jobSettings" | "observability" | "pamiPlanillaAdminCatalog" | "pamiPlanillaAdminError"
> = {
  pluginSettings: [],
  flagSettings: [],
  jobSettings: [],
  observability: undefined,
  pamiPlanillaAdminCatalog: undefined,
  pamiPlanillaAdminError: undefined,
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
      const result = await loadPamiPlanillaAdminCatalog();
      return {
        ...EMPTY_EXTRAS,
        pamiPlanillaAdminCatalog: result && "catalog" in result ? result.catalog : undefined,
        pamiPlanillaAdminError: result && "error" in result ? result.error : undefined,
      };
    }
    default:
      return EMPTY_EXTRAS;
  }
}
