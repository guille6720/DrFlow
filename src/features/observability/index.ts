export {
  SLOW_QUERY_MS,
  SLOW_REQUEST_MS,
  SLOW_JOB_MS,
  CATEGORY_LABELS,
  STATUS_LABELS,
  inferStatusFromDuration,
  thresholdForCategory,
  createTraceId,
  recordObservabilityEvent,
  withObservabilityTiming,
  getHealthStatus,
  type ObservabilityCategory,
  type ObservabilityStatus,
} from "@/lib/observability";
export { getClinicObservabilityDashboard } from "@/lib/actions/observability";
