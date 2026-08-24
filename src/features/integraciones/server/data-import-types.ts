import type { DuplicateDecisionSet } from "@/features/integraciones/lib/patient-import-duplicates";
import type { PatientColumnMapping } from "@/features/integraciones/lib/patient-import-mapping";
import type { PatientImportIssue } from "@/features/integraciones/lib/patient-import-validate";

export type DataImportSessionStatus =
  | "uploading"
  | "parsing"
  | "validating"
  | "ready"
  | "importing"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancelled";

export type DataImportSessionRow = {
  id: string;
  clinic_id: string;
  created_by: string | null;
  import_type: string;
  original_filename: string;
  storage_path: string;
  status: DataImportSessionStatus;
  column_mapping: PatientColumnMapping;
  date_format: string | null;
  template_id: string | null;
  headers: string[];
  preview_rows: Record<string, string>[];
  stats: PatientImportStats;
  duplicate_decisions: DuplicateDecisionSet;
  invalid_sample: PatientImportIssue[];
  duplicate_sample: unknown[];
  error_summary: string | null;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type PatientImportStats = {
  total: number;
  ready: number;
  duplicates: number;
  invalid: number;
};

export type ImportMappingTemplateRow = {
  id: string;
  clinic_id: string;
  name: string;
  import_type: string;
  mapping: PatientColumnMapping;
  date_format: string | null;
  last_used_at: string | null;
};
