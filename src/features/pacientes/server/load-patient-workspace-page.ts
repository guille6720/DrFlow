import type { SupabaseClient } from "@supabase/supabase-js";

import { unwrapNestedRow } from "@/core/supabase/nested-row";
import {
  encodeDescCursor,
  PATIENT_ATTACHMENTS_LIMIT,
  PATIENT_EHR_RECORD_PAGE_SIZE,
} from "@/core/supabase/pagination";
import type { ProfessionalListRow } from "@/core/supabase/query-types";

import type { ClinicalDocumentItem } from "@/features/historias/components/historias/clinical-documents-panel";
import type { PatientChartAppointment, PatientChartPatient } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { ClinicalTemplateRow } from "@/features/pacientes/components/pacientes/patient-workspace-types";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import {
  buildPatientEhrWorkspaceData,
  mapClinicalRecordsForEhr,
  mapTimelineAppointments,
  PATIENT_EHR_RECORD_LIMIT,
  PATIENT_RX_FETCH_LIMIT,
  PATIENT_TIMELINE_APPOINTMENT_LIMIT,
  type PatientEhrWorkspaceData,
} from "@/features/pacientes/server/load-patient-ehr-data";
import {
  mergePatientClinicalFields,
  type PatientClinicalProfileFields,
} from "@/features/pacientes/server/patient-clinical-profile";
import { getWorkspaceFetchPlan } from "@/features/pacientes/server/patient-workspace-fetch-plan";
import { buildPatientChartPayload } from "@/features/pacientes/utils/patient-chart-model";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import { HCE_SUMMARY_ATTACHMENT_NAME, loadPatientHceSummaryRows } from "@/features/pacientes/utils/patient-ehr-from-hce";
import { loadActiveCoverageRulesForClinic } from "@/features/recetas/repositories/coverage-rules.repository";
import {
  buildCoverageRuleOverridesMap,
  type CoverageRuleOverridesMap,
} from "@/features/recetas/utils/coverage-rules-admin";

import {
  getCachedClinicalTemplates,
  getCachedClinicProfessionalsList,
  getCachedPortalContext,
} from "@/lib/server/cached-clinic-queries";
import { resolveDefaultProfessionalId } from "@/lib/server/resolve-default-professional";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";
import type { MedicalOrder } from "@/types/medical-order";
import type { PrescriptionMedication } from "@/types/prescription";

export type PatientWorkspaceProfessional = {
  id: string;
  display_name: string | null;
  license_number: string | null;
  profiles: { full_name: string } | null;
};

export type PatientWorkspacePagePayload = {
  patient: PatientRow;
  ehr: PatientEhrWorkspaceData;
  chart: PatientChartPayload;
  appointments: PatientChartAppointment[];
  clinicalDocuments: ClinicalDocumentItem[];
  professionals: PatientWorkspaceProfessional[];
  defaultProfessionalId: string | undefined;
  lastMedications: PrescriptionMedication[] | null;
  templates: ClinicalTemplateRow[];
  patientShare: {
    sharedAt: string;
    sharedByName: string | null;
    channel: string;
  } | null;
  portalSlug: string | null;
  doctorInfo: DoctorShareInfo | null;
  coverageRuleOverrides: CoverageRuleOverridesMap;
};

type PatientRow = PatientChartPatient &
  PatientClinicalProfileFields & {
    is_active?: boolean;
  };

function mapClinicalDocuments(
  rows: Array<{
    id: string;
    file_name: string;
    file_size: number | null;
    category: string | null;
    created_at: string;
    profiles: unknown;
  }> | null
): ClinicalDocumentItem[] {
  return (
    rows?.map((d) => ({
      id: d.id,
      file_name: d.file_name,
      file_size: d.file_size,
      category: d.category,
      created_at: d.created_at,
      profiles: d.profiles as ClinicalDocumentItem["profiles"],
    })) ?? []
  );
}

function mapChartAppointments(rows: unknown): PatientChartAppointment[] {
  return (rows ?? []) as PatientChartAppointment[];
}

function mapProfessionals(rows: ProfessionalListRow[] | null): PatientWorkspaceProfessional[] {
  return (
    rows?.map((p) => ({
      id: p.id,
      display_name: p.display_name,
      license_number: p.license_number,
      profiles: unwrapNestedRow(p.profiles),
    })) ?? []
  );
}

/** Parallel fetch for patient workspace — scoped to active tab when provided. */
export async function loadPatientWorkspacePageData(
  supabase: SupabaseClient,
  clinicId: string,
  patient: PatientRow,
  activeTab?: PatientWorkspaceTabId
): Promise<PatientWorkspacePagePayload> {
  const patientId = patient.id;
  const plan = getWorkspaceFetchPlan(activeTab ?? "resumen");
  const recordLimit = Math.min(plan.recordLimit ?? PATIENT_EHR_RECORD_PAGE_SIZE, PATIENT_EHR_RECORD_LIMIT);

  const portalContextPromise = getCachedPortalContext(clinicId);
  const professionalsPromise = getCachedClinicProfessionalsList(clinicId);
  const clinicalProfilePromise = supabase
    .from("patient_clinical_profiles")
    .select("medical_history, allergies, regular_medication, notes")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const templatesPromise = plan.templates
    ? getCachedClinicalTemplates(clinicId)
    : Promise.resolve([] as ClinicalTemplateRow[]);

  const recordsPromise = plan.clinicalRecords
    ? supabase
        .from("clinical_records")
        .select(
          "id, created_at, chief_complaint, diagnosis, evolution, indications, professionals(profiles(full_name))",
          { count: "exact" }
        )
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(recordLimit)
    : Promise.resolve({ data: [], count: 0 });

  const attachmentsPromise = plan.attachments
    ? supabase
        .from("patient_attachments")
        .select("id, file_name, file_path, file_size, category, created_at, profiles:uploaded_by(full_name)")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(PATIENT_ATTACHMENTS_LIMIT)
    : Promise.resolve({ data: [] });

  const rxPromise = plan.prescriptions
    ? supabase
        .from("prescription_drafts")
        .select(
          "id, created_at, medications, status, diagnosis_text, diagnosis_cie10, issued_at, prescription_number, prescription_type, validity_days, patient_insurance, coverage_kind, insurance_number, insurance_plan, dispensed_at, notes, professional_id"
        )
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(PATIENT_RX_FETCH_LIMIT)
    : Promise.resolve({ data: [] });

  const ordersPromise = plan.orders
    ? supabase
        .from("medical_orders")
        .select("id, order_text, notes, status, issued_at, created_at, updated_at, version, professional_id, patient_id, clinical_record_id, order_type")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .order("issued_at", { ascending: false })
        .limit(50)
    : Promise.resolve({ data: [] });

  const appointmentsPromise = plan.appointments
    ? supabase
        .from("appointments")
        .select(
          "id, start_at, status, cancellation_reason, cancelled_by_type, professionals(profiles(full_name))"
        )
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .order("start_at", { ascending: false })
        .limit(PATIENT_TIMELINE_APPOINTMENT_LIMIT)
    : Promise.resolve({ data: [] });

  const coverageRulesPromise = plan.prescriptions
    ? loadActiveCoverageRulesForClinic(supabase, clinicId)
    : Promise.resolve({ ok: true as const, data: [] });

  const [
    portalContext,
    { data: records, count: totalRecords },
    { data: attachments },
    { data: rxList },
    { data: orders },
    { data: allAppointments },
    professionals,
    clinicalProfileResult,
    templates,
    coverageRulesResult,
  ] = await Promise.all([
    portalContextPromise,
    recordsPromise,
    attachmentsPromise,
    rxPromise,
    ordersPromise,
    appointmentsPromise,
    professionalsPromise,
    clinicalProfilePromise,
    templatesPromise,
    coverageRulesPromise,
  ]);

  const { portalSlug, doctorInfo } = portalContext;

  const hceAttachment = attachments?.find((a) => a.file_name === HCE_SUMMARY_ATTACHMENT_NAME);
  const hceRows = plan.hceSummary
    ? await loadPatientHceSummaryRows(
        supabase,
        clinicId,
        patientId,
        hceAttachment?.file_path ?? null
      )
    : [];

  const appShareResult = portalSlug
    ? await supabase
        .from("patient_app_share_log")
        .select("shared_at, channel, profiles(full_name)")
        .eq("patient_id", patientId)
        .maybeSingle()
    : { data: null };

  const timelineAppointments = (allAppointments ?? []).filter((a) =>
    ["attended", "no_show"].includes(a.status as string)
  );

  const patientWithClinical = mergePatientClinicalFields(patient, clinicalProfileResult.data);

  const mappedRecords = mapClinicalRecordsForEhr(records);
  const loadedRecords = mappedRecords.length;
  const totalRecordCount = typeof totalRecords === "number" ? totalRecords : loadedRecords;
  const hasMoreRecords = loadedRecords < totalRecordCount;
  const oldestLoaded = records?.at(-1);
  const clinicalRecordsPagination = plan.clinicalRecords
    ? {
        total: totalRecordCount,
        hasMore: hasMoreRecords,
        nextCursor:
          hasMoreRecords && oldestLoaded
            ? encodeDescCursor(oldestLoaded.created_at, oldestLoaded.id)
            : null,
      }
    : {
        total: 0,
        hasMore: false,
        nextCursor: null,
      };

  const ehr = buildPatientEhrWorkspaceData({
    patient,
    totalRecords,
    mappedRecords,
    attachments,
    rxList,
    orders: (orders ?? []) as (MedicalOrder & { order_type?: string })[],
    timelineAppointments: mapTimelineAppointments(timelineAppointments),
    hceRows,
    clinicalRecordsPagination,
  });

  const clinicalDocuments = mapClinicalDocuments(attachments);
  const issuedPrescriptions = (rxList ?? []).filter((rx) => rx.status === "issued");
  const lastRx = issuedPrescriptions[0];
  const lastMedications = (lastRx?.medications as PrescriptionMedication[] | null) ?? null;

  const chart = buildPatientChartPayload({
    patient: {
      birth_date: patientWithClinical.birth_date,
      insurance_provider: patientWithClinical.insurance_provider,
      medical_history: patientWithClinical.medical_history,
      allergies: patientWithClinical.allergies,
      regular_medication: patientWithClinical.regular_medication,
      notes: patientWithClinical.notes,
    },
    records: mappedRecords,
    prescriptions: issuedPrescriptions.map((p) => ({
      id: p.id,
      created_at: p.issued_at ?? p.created_at,
      medications: p.medications,
    })),
    attachments: clinicalDocuments.map((d) => {
      const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
      return {
        id: d.id,
        file_name: d.file_name,
        category: d.category,
        created_at: d.created_at,
        uploaded_by: profile?.full_name ?? null,
      };
    }),
  });

  const appShare = appShareResult.data;
  const shareProfile = appShare?.profiles as { full_name?: string } | null;
  const mappedProfessionals = mapProfessionals(professionals);
  const defaultProfessionalId = await resolveDefaultProfessionalId(
    supabase,
    clinicId,
    mappedProfessionals
  );

  const coverageRuleOverrides =
    coverageRulesResult.ok && coverageRulesResult.data.length > 0
      ? buildCoverageRuleOverridesMap(coverageRulesResult.data)
      : {};

  return {
    patient: patientWithClinical,
    ehr,
    chart,
    appointments: mapChartAppointments(allAppointments),
    clinicalDocuments,
    professionals: mappedProfessionals,
    defaultProfessionalId,
    lastMedications,
    templates: (templates ?? []) as ClinicalTemplateRow[],
    patientShare: appShare
      ? {
          sharedAt: appShare.shared_at,
          sharedByName: shareProfile?.full_name ?? null,
          channel: appShare.channel,
        }
      : null,
    portalSlug,
    doctorInfo,
    coverageRuleOverrides,
  };
}
