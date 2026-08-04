export { ConsultationPhysicianAssist } from "@/features/ia/components/clinical-workflow/consultation-physician-assist";
export { InlinePhysicianAssist } from "@/features/ia/components/clinical-workflow/inline-physician-assist";
export { PrescriptionPhysicianAssist } from "@/features/ia/components/clinical-workflow/prescription-physician-assist";
export { OrderPhysicianAssist } from "@/features/ia/components/clinical-workflow/order-physician-assist";
export { ClinicalSummaryPhysicianAssist } from "@/features/ia/components/clinical-workflow/clinical-summary-physician-assist";
export { PreVisitBriefPanel } from "@/features/ia/components/clinical-workflow/pre-visit-brief-panel";
export {
  buildClinicalSummary,
  buildMedicationSafetyWarnings,
  buildPhysicianAssistItems,
  extractPathologySearchQuery,
} from "@/lib/utils/clinical-assistant";
export { buildPreVisitBrief, formatMonthsSince } from "@/lib/utils/pre-visit-brief";
export type { PreVisitBrief, PreVisitBriefSection } from "@/lib/utils/pre-visit-brief";
export {
  buildEvolutionDraftSuggestion,
  buildPhysicalExamSuggestion,
  buildTherapeuticPlanSuggestion,
  buildCie10Suggestions,
  buildConsultationDocumentationItems,
} from "@/lib/utils/consultation-documentation";
export type { Cie10Suggestion } from "@/lib/utils/consultation-documentation";
export { ConsultationCie10Panel } from "@/features/ia/components/clinical-workflow/consultation-cie10-panel";
export {
  buildOrderDraftSuggestion,
  buildCoverageNoteItem,
  buildDosageHintItems,
  buildMedicationOrderAssistItems,
  getMatchedOrderPanelLabels,
} from "@/lib/utils/medication-order-assist";
export { OrderSuggestionPanel } from "@/features/ia/components/clinical-workflow/order-suggestion-panel";
export { LabInterpretationPanel } from "@/features/ia/components/clinical-workflow/lab-interpretation-panel";
export { CloseEncounterWizardSheet } from "@/features/ia/components/clinical-workflow/close-encounter-wizard-sheet";
export { CloseEncounterWizardPanel } from "@/features/ia/components/clinical-workflow/close-encounter-wizard-panel";
export { FollowUpPhysicianAssist } from "@/features/ia/components/clinical-workflow/follow-up-physician-assist";
export {
  parseLabValuesFromText,
  compareLabsWithHistory,
  classifyLabValue,
  buildLabInterpretationItem,
} from "@/lib/utils/lab-interpretation";
export type { ParsedLabValue, LabComparisonRow } from "@/lib/utils/lab-interpretation";
export {
  buildCloseEncounterSteps,
  buildCloseEncounterBundleText,
} from "@/lib/utils/close-encounter-assist";
export type { CloseEncounterStep, CloseEncounterStepId } from "@/lib/utils/close-encounter-assist";
export { ProactiveCarePanel } from "@/features/ia/components/clinical-workflow/proactive-care-panel";
export { ClinicalCopilotSheet } from "@/features/ia/components/clinical-workflow/clinical-copilot-sheet";
export { ClinicalCopilotHost } from "@/features/ia/components/clinical-workflow/clinical-copilot-host";
export {
  buildProactiveCareItems,
  buildProactiveCareSummaryText,
  sortProactiveCareItems,
} from "@/lib/utils/proactive-follow-up";
export type { ProactiveCareItem, ProactiveCareSeverity } from "@/lib/utils/proactive-follow-up";
export {
  matchCopilotIntent,
  runClinicalCopilotQuery,
  buildCopilotSuggestedPrompts,
} from "@/lib/utils/clinical-copilot";
export type { ClinicalCopilotContext, CopilotResponse } from "@/lib/utils/clinical-copilot";
export {
  runClinicalAiOrchestrator,
  listClinicalAiAgents,
  resolveAgentForTask,
  CLINICAL_AI_AGENT_LABELS,
} from "@/lib/utils/clinical-ai-orchestrator";
export type {
  ClinicalAiAgentId,
  ClinicalAiTask,
  ClinicalAiOrchestratorResult,
  ClinicalAiEngine,
} from "@/lib/utils/clinical-ai-orchestrator";
export {
  runAdminOpsOrchestrator,
  listAdminOpsAgents,
  ADMIN_OPS_AGENT_LABELS,
} from "@/features/dashboard/utils/admin-ops-orchestrator";
export type {
  AdminOpsAgentId,
  AdminOpsTask,
  AdminOpsOrchestratorResult,
} from "@/features/dashboard/utils/admin-ops-orchestrator";
export {
  matchAdminOpsIntent,
  buildAdminOpsSuggestedPrompts,
  buildAdminOpsResponse,
} from "@/features/dashboard/utils/admin-ops-assistant";
export type { AdminOpsContext, AdminOpsSnapshot } from "@/features/dashboard/utils/admin-ops-types";
export type { AdminAnalyticsSnapshot } from "@/lib/utils/admin-analytics-types";
export { formatCurrencyAr, formatBreakdownLines } from "@/lib/utils/admin-analytics-types";
export { AdminOpsCopilotHost } from "@/features/ia/components/admin-ops/admin-ops-copilot-host";
export { AdminOpsCopilotSheet } from "@/features/ia/components/admin-ops/admin-ops-copilot-sheet";
export type {
  PhysicianAssistContext,
  PhysicianAssistItem,
  PhysicianAssistKind,
} from "@/features/ia/types/physician-assist-types";
