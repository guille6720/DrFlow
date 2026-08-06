import { SettingsPanel } from "@/features/configuracion";
import { AiProviderPanel } from "@/features/configuracion/components/configuracion/ai-provider-panel";
import { AppearanceStylePanel } from "@/features/configuracion/components/configuracion/appearance-style-panel";
import { ClinicAccessibilityPanel } from "@/features/configuracion/components/configuracion/clinic-accessibility-panel";
import { ClinicFeatureFlagsPanel } from "@/features/configuracion/components/configuracion/clinic-feature-flags-panel";
import { ClinicJobsPanel } from "@/features/configuracion/components/configuracion/clinic-jobs-panel";
import { ClinicObservabilityPanel } from "@/features/configuracion/components/configuracion/clinic-observability-panel";
import { ClinicPluginsPanel } from "@/features/configuracion/components/configuracion/clinic-plugins-panel";
import { ComplianceLegalPanel } from "@/features/configuracion/components/configuracion/compliance-legal-panel";
import type { ConfiguracionSectionId } from "@/features/configuracion/components/configuracion/configuracion-sections";
import { CoveragesPanel } from "@/features/configuracion/components/configuracion/coverages-panel";
import { DemoDataPanel } from "@/features/configuracion/components/configuracion/demo-data-panel";
import { PamiSetupPanel } from "@/features/configuracion/components/configuracion/pami-setup-panel";

import type { Clinic } from "@/types/database";

export interface SettingsPanelData {
  clinic: Clinic | null;
  professionals: never[];
  members: never[];
  invitations: never[];
  bookingSlug: string | null;
  teamAccess?: import("@/lib/actions/team-permissions").TeamPermissionsPanelData & {
    hasSharedCredentials: boolean;
  };
}

export interface ConfiguracionSectionExtras {
  patientCount: number;
  practiceProfile: string | null;
  defaultInsurance: string | null;
  acceptedCoverages: string[] | null;
  pluginSettings: Array<{
    id: import("@/plugins/registry").PluginId;
    label: string;
    description: string;
    tier: string;
    enabled: boolean;
  }>;
  flagSettings: Array<{
    id: import("@/features/flags/lib/registry").FeatureFlagId;
    label: string;
    description: string;
    category: string;
    enabled: boolean;
    requiresPlugin?: string;
  }>;
  jobSettings: Array<{
    id: string;
    jobType: string;
    jobLabel: string;
    status: import("@/core/jobs/registry").ClinicJobStatus;
    statusLabel: string;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  observability?: {
    snapshot: import("@/lib/server/load-observability").ObservabilitySnapshot;
    health: import("@/core/observability/health").HealthStatus;
  };
}

export function renderConfiguracionSectionContent(
  sectionId: ConfiguracionSectionId,
  settingsProps: SettingsPanelData,
  extras: ConfiguracionSectionExtras
) {
  switch (sectionId) {
    case "legal":
      return <ComplianceLegalPanel />;
    case "apariencia":
      return <AppearanceStylePanel />;
    case "asistente-ia":
      return <AiProviderPanel />;
    case "coberturas":
      return (
        <CoveragesPanel
          acceptedCoverages={extras.acceptedCoverages}
          defaultInsurance={extras.defaultInsurance}
        />
      );
    case "pami":
      return (
        <PamiSetupPanel
          practiceProfile={extras.practiceProfile}
          defaultInsurance={extras.defaultInsurance}
        />
      );
    case "plugins":
      return <ClinicPluginsPanel plugins={extras.pluginSettings} />;
    case "flags":
      return <ClinicFeatureFlagsPanel flags={extras.flagSettings} />;
    case "jobs":
      return <ClinicJobsPanel jobs={extras.jobSettings} />;
    case "observabilidad":
      return extras.observability ? (
        <ClinicObservabilityPanel
          snapshot={extras.observability.snapshot}
          health={extras.observability.health}
        />
      ) : null;
    case "accesibilidad":
      return <ClinicAccessibilityPanel />;
    case "demo":
      return <DemoDataPanel patientCount={extras.patientCount} />;
    case "clinica":
      return <SettingsPanel section="clinica" {...settingsProps} />;
    case "equipo":
      return <SettingsPanel section="equipo" {...settingsProps} />;
    case "agenda":
      return <SettingsPanel section="agenda" {...settingsProps} />;
    case "apps":
      return <SettingsPanel section="apps" {...settingsProps} />;
    default:
      return null;
  }
}
