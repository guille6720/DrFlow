import { SettingsPanel } from "@/features/configuracion";
import { DemoDataPanel } from "@/components/configuracion/demo-data-panel";
import { PamiSetupPanel } from "@/components/configuracion/pami-setup-panel";
import { CoveragesPanel } from "@/components/configuracion/coverages-panel";
import { AppearanceStylePanel } from "@/components/configuracion/appearance-style-panel";
import { ComplianceLegalPanel } from "@/components/configuracion/compliance-legal-panel";
import { ClinicPluginsPanel } from "@/components/configuracion/clinic-plugins-panel";
import { ClinicFeatureFlagsPanel } from "@/components/configuracion/clinic-feature-flags-panel";
import { ClinicJobsPanel } from "@/components/configuracion/clinic-jobs-panel";
import { ClinicObservabilityPanel } from "@/components/configuracion/clinic-observability-panel";
import { ClinicAccessibilityPanel } from "@/components/configuracion/clinic-accessibility-panel";
import type { ConfiguracionSectionId } from "@/components/configuracion/configuracion-sections";
import type { Clinic } from "@/types/database";

export interface SettingsPanelData {
  clinic: Clinic | null;
  professionals: never[];
  members: never[];
  invitations: never[];
  bookingSlug: string | null;
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
    id: import("@/lib/features/flags/registry").FeatureFlagId;
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
    status: import("@/lib/jobs/registry").ClinicJobStatus;
    statusLabel: string;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  observability?: {
    snapshot: import("@/lib/server/load-observability").ObservabilitySnapshot;
    health: import("@/lib/observability/health").HealthStatus;
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
