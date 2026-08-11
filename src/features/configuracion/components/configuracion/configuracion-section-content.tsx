import { SettingsPanel } from "@/features/configuracion";
import { AiProviderPanel } from "@/features/configuracion/components/configuracion/ai-provider-panel";
import { AppearanceStylePanel } from "@/features/configuracion/components/configuracion/appearance-style-panel";
import { ClinicAccessibilityPanel } from "@/features/configuracion/components/configuracion/clinic-accessibility-panel";
import { ClinicFeatureFlagsPanel } from "@/features/configuracion/components/configuracion/clinic-feature-flags-panel";
import { ClinicJobsPanel } from "@/features/configuracion/components/configuracion/clinic-jobs-panel";
import { ClinicObservabilityPanel } from "@/features/configuracion/components/configuracion/clinic-observability-panel";
import { ClinicPlanPanelLoader } from "@/features/configuracion/components/configuracion/clinic-plan-panel-loader";
import { ClinicPluginsPanel } from "@/features/configuracion/components/configuracion/clinic-plugins-panel";
import { ComplianceLegalPanel } from "@/features/configuracion/components/configuracion/compliance-legal-panel";
import type { ConfiguracionSectionId } from "@/features/configuracion/components/configuracion/configuracion-sections";
import { CoveragesPanel } from "@/features/configuracion/components/configuracion/coverages-panel";
import { DemoDataPanel } from "@/features/configuracion/components/configuracion/demo-data-panel";
import { PamiPlanillasAdminPanel } from "@/features/configuracion/components/configuracion/pami-planillas-admin-panel";
import { PamiSetupPanel } from "@/features/configuracion/components/configuracion/pami-setup-panel";
import { PrescriptionCoverageRulesManager } from "@/features/configuracion/components/configuracion/prescription-coverage-rules-manager";
import { PublicApiKeysPanel } from "@/features/configuracion/components/configuracion/public-api-keys-panel";
import { RefepsSettingsPanel } from "@/features/configuracion/components/configuracion/refeps-settings-panel";
import type { SettingsPanelProps } from "@/features/configuracion/components/configuracion/settings-panel";
import type { CoverageRuleRow } from "@/features/recetas/repositories/coverage-rules.repository";

import type { PamiPlanillaAdminCatalog } from "@/lib/actions/pami-planilla-admin";

export type SettingsPanelData = Pick<
  SettingsPanelProps,
  "clinic" | "professionals" | "members" | "invitations" | "bookingSlug" | "teamAccess" | "locations"
>;

export interface ConfiguracionSectionExtras {
  patientCount: number;
  practiceProfile: string | null;
  defaultInsurance: string | null;
  acceptedCoverages: string[] | null;
  paymentNotice?: "ok" | "error" | "pending" | null;
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
  pamiPlanillaAdminCatalog?: PamiPlanillaAdminCatalog;
  pamiPlanillaAdminError?: string;
  pamiCoverageRule?: CoverageRuleRow | null;
  pamiCoverageRuleError?: string;
  prescriptionCoverageRules?: CoverageRuleRow[];
  prescriptionCoverageRulesError?: string;
  refepsSettings?: import("@/lib/actions/refeps").RefepsClinicSettingsView;
  refepsSettingsError?: string;
  apiPublicKeys?: import("@/lib/actions/public-api-keys").ClinicApiKeyRow[];
}

export function renderConfiguracionSectionContent(
  sectionId: ConfiguracionSectionId,
  settingsProps: SettingsPanelData,
  extras: ConfiguracionSectionExtras
) {
  switch (sectionId) {
    case "plan":
      return <ClinicPlanPanelLoader paymentNotice={extras.paymentNotice} />;
    case "legal":
      return <ComplianceLegalPanel />;
    case "apariencia":
      return <AppearanceStylePanel />;
    case "asistente-ia":
      return <AiProviderPanel />;
    case "coberturas":
      return (
        <div className="space-y-6">
          <CoveragesPanel
            acceptedCoverages={extras.acceptedCoverages}
            defaultInsurance={extras.defaultInsurance}
          />
          <PrescriptionCoverageRulesManager
            savedRules={extras.prescriptionCoverageRules ?? []}
          />
          {extras.refepsSettings ? (
            <RefepsSettingsPanel settings={extras.refepsSettings} />
          ) : extras.refepsSettingsError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {extras.refepsSettingsError}
            </div>
          ) : null}
          {extras.prescriptionCoverageRulesError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {extras.prescriptionCoverageRulesError}
            </div>
          ) : null}
        </div>
      );
    case "pami":
      return (
        <div className="space-y-6">
          <PamiSetupPanel
            practiceProfile={extras.practiceProfile}
            defaultInsurance={extras.defaultInsurance}
          />
          {extras.pamiPlanillaAdminCatalog ? (
            <PamiPlanillasAdminPanel initialCatalog={extras.pamiPlanillaAdminCatalog} />
          ) : extras.pamiPlanillaAdminError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {extras.pamiPlanillaAdminError}
            </div>
          ) : null}
        </div>
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
    case "api-publica":
      return <PublicApiKeysPanel keys={extras.apiPublicKeys ?? []} />;
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
