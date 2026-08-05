export {
  buildAdminOpsResponse,
  buildAdminOpsSuggestedPrompts,
  matchAdminOpsIntent,
} from "@/features/dashboard/utils/admin-ops-assistant";
export type {
  AdminOpsAgentId,
  AdminOpsOrchestratorResult,
  AdminOpsTask,
} from "@/features/dashboard/utils/admin-ops-orchestrator";
export {
  ADMIN_OPS_AGENT_LABELS,
  listAdminOpsAgents,
  runAdminOpsOrchestrator,
} from "@/features/dashboard/utils/admin-ops-orchestrator";
export type { AdminOpsContext, AdminOpsSnapshot } from "@/features/dashboard/utils/admin-ops-types";
export { AdminOpsCopilotHost } from "@/features/ia/components/admin-ops/admin-ops-copilot-host";
export { AdminOpsCopilotSheet } from "@/features/ia/components/admin-ops/admin-ops-copilot-sheet";
export { ClinicalCopilotHost } from "@/features/ia/components/clinical-workflow/clinical-copilot-host";
export { ClinicalCopilotSheet } from "@/features/ia/components/clinical-workflow/clinical-copilot-sheet";
export { ClinicalSummaryPhysicianAssist } from "@/features/ia/components/clinical-workflow/clinical-summary-physician-assist";
export { CloseEncounterWizardPanel } from "@/features/ia/components/clinical-workflow/close-encounter-wizard-panel";
export { CloseEncounterWizardSheet } from "@/features/ia/components/clinical-workflow/close-encounter-wizard-sheet";
export { ConsultationCie10Panel } from "@/features/ia/components/clinical-workflow/consultation-cie10-panel";
export { ConsultationPhysicianAssist } from "@/features/ia/components/clinical-workflow/consultation-physician-assist";
export { FollowUpPhysicianAssist } from "@/features/ia/components/clinical-workflow/follow-up-physician-assist";
export { InlinePhysicianAssist } from "@/features/ia/components/clinical-workflow/inline-physician-assist";
export { LabInterpretationPanel } from "@/features/ia/components/clinical-workflow/lab-interpretation-panel";
export { OrderPhysicianAssist } from "@/features/ia/components/clinical-workflow/order-physician-assist";
export { OrderSuggestionPanel } from "@/features/ia/components/clinical-workflow/order-suggestion-panel";
export { PreVisitBriefPanel } from "@/features/ia/components/clinical-workflow/pre-visit-brief-panel";
export { PrescriptionPhysicianAssist } from "@/features/ia/components/clinical-workflow/prescription-physician-assist";
export { ProactiveCarePanel } from "@/features/ia/components/clinical-workflow/proactive-care-panel";
export type {
  PhysicianAssistContext,
  PhysicianAssistItem,
  PhysicianAssistKind,
} from "@/features/ia/types/physician-assist-types";
export type { AdminAnalyticsSnapshot } from "@/lib/utils/admin-analytics-types";
export { formatBreakdownLines, formatCurrencyAr } from "@/lib/utils/admin-analytics-types";
export type {
  ClinicalAiAgentId,
  ClinicalAiEngine,
  ClinicalAiOrchestratorResult,
  ClinicalAiTask,
} from "@/lib/utils/clinical-ai-orchestrator";
export {
  CLINICAL_AI_AGENT_LABELS,
  listClinicalAiAgents,
  resolveAgentForTask,
  runClinicalAiOrchestrator,
} from "@/lib/utils/clinical-ai-orchestrator";
export {
  buildClinicalSummary,
  buildMedicationSafetyWarnings,
  buildPhysicianAssistItems,
  extractPathologySearchQuery,
} from "@/lib/utils/clinical-assistant";
export type { ClinicalCopilotContext, CopilotResponse } from "@/lib/utils/clinical-copilot";
export {
  buildCopilotSuggestedPrompts,
  matchCopilotIntent,
  runClinicalCopilotQuery,
} from "@/lib/utils/clinical-copilot";
export type { CloseEncounterStep, CloseEncounterStepId } from "@/lib/utils/close-encounter-assist";
export {
  buildCloseEncounterBundleText,
  buildCloseEncounterSteps,
} from "@/lib/utils/close-encounter-assist";
export type { Cie10Suggestion } from "@/lib/utils/consultation-documentation";
export {
  buildCie10Suggestions,
  buildConsultationDocumentationItems,
  buildEvolutionDraftSuggestion,
  buildPhysicalExamSuggestion,
  buildTherapeuticPlanSuggestion,
} from "@/lib/utils/consultation-documentation";
export type { LabComparisonRow, ParsedLabValue } from "@/lib/utils/lab-interpretation";
export {
  buildLabInterpretationItem,
  classifyLabValue,
  compareLabsWithHistory,
  parseLabValuesFromText,
} from "@/lib/utils/lab-interpretation";
export {
  buildCoverageNoteItem,
  buildDosageHintItems,
  buildMedicationOrderAssistItems,
  buildOrderDraftSuggestion,
  getMatchedOrderPanelLabels,
} from "@/lib/utils/medication-order-assist";
export type { PreVisitBrief, PreVisitBriefSection } from "@/lib/utils/pre-visit-brief";
export { buildPreVisitBrief, formatMonthsSince } from "@/lib/utils/pre-visit-brief";
export type { ProactiveCareItem, ProactiveCareSeverity } from "@/lib/utils/proactive-follow-up";
export {
  buildProactiveCareItems,
  buildProactiveCareSummaryText,
  sortProactiveCareItems,
} from "@/lib/utils/proactive-follow-up";
