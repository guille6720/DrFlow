export type PrescriptionType = "ambulatoria" | "cronica" | "duplicado";
export type PrescriptionStatus = "draft" | "issued" | "void";
export type RefepsStatus = "local" | "pending_refeps" | "submitted" | "failed";
export type PrescriptionCoverageKind = "PAMI" | "OBRAS_SOCIALES" | "PREPAGAS" | "PARTICULAR";

export interface PrescriptionMedication {
  generic_name: string;
  brand_name?: string;
  presentation?: string;
  concentration?: string;
  quantity: number;
  posology: string;
  route?: string;
  prolonged_treatment?: boolean;
  /** Extended fields (optional, backward compatible) */
  active_ingredient?: string;
  pharmaceutical_form?: string;
  dose?: string;
  frequency?: string;
  duration_days?: number;
  instructions?: string;
  vademecum_code?: string;
  search_source?: "catalog" | "pami" | "generic" | "manual";
}

export interface ElectronicPrescription {
  id: string;
  clinic_id: string;
  patient_id: string;
  clinical_record_id: string | null;
  professional_id: string;
  medications: PrescriptionMedication[];
  notes: string | null;
  disclaimer_accepted: boolean;
  prescription_type: PrescriptionType;
  diagnosis_cie10: string | null;
  diagnosis_text: string | null;
  status: PrescriptionStatus;
  prescription_number: string | null;
  issued_at: string | null;
  validity_days: number;
  refeps_status: RefepsStatus;
  refeps_id: string | null;
  refeps_submitted_at?: string | null;
  refeps_error?: string | null;
  refeps_payload?: Record<string, unknown> | null;
  digital_signature_hash?: string | null;
  patient_insurance: string | null;
  coverage_kind: PrescriptionCoverageKind | null;
  insurance_number: string | null;
  insurance_plan: string | null;
  idempotency_key: string | null;
  dispensed_at: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const PRESCRIPTION_TYPE_LABELS: Record<PrescriptionType, string> = {
  ambulatoria: "Ambulatoria",
  cronica: "Crónica / prolongada",
  duplicado: "Duplicado (psicotrópicos)",
};

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  draft: "Borrador",
  issued: "Emitida",
  void: "Anulada",
};

/** UI alias for cancelled prescriptions */
export const PRESCRIPTION_STATUS_UI_ALIASES: Partial<Record<PrescriptionStatus, string>> = {
  void: "Cancelada",
};

export function resolvePrescriptionDisplayStatus(row: Pick<ElectronicPrescription, "status" | "dispensed_at">): string {
  if (row.status === "issued" && row.dispensed_at) return "Dispensada";
  if (row.status === "void") return PRESCRIPTION_STATUS_UI_ALIASES.void ?? PRESCRIPTION_STATUS_LABELS.void;
  return PRESCRIPTION_STATUS_LABELS[row.status];
}

export const REFEPS_STATUS_LABELS: Record<RefepsStatus, string> = {
  local: "Local (sin REFEPS)",
  pending_refeps: "Pendiente REFEPS",
  /** Adapter result — not a claim of MSN homologation / government approval. */
  submitted: "Enviada (adapter REFEPS)",
  failed: "Error REFEPS",
};

export const ARGENTINA_PRESCRIPTION_DISCLAIMER =
  "Receta local / borrador — no es homologación REFEPS. " +
  "Generada en DrFlow según Ley 25.649 (prescripción por nombre genérico). " +
  "Para validez ante farmacias con trazabilidad REFEPS/RENaPDiS, la clínica debe completar " +
  "homologación con el Ministerio de Salud de la Nación y firma digital habilitante.";

function isPrescriptionType(value: string): value is PrescriptionType {
  return value === "ambulatoria" || value === "cronica" || value === "duplicado";
}

function isPrescriptionStatus(value: string): value is PrescriptionStatus {
  return value === "draft" || value === "issued" || value === "void";
}

function isRefepsStatus(value: string): value is RefepsStatus {
  return (
    value === "local" ||
    value === "pending_refeps" ||
    value === "submitted" ||
    value === "failed"
  );
}

function isCoverageKind(value: string | null): value is PrescriptionCoverageKind | null {
  if (value === null) return true;
  return (
    value === "PAMI" ||
    value === "OBRAS_SOCIALES" ||
    value === "PREPAGAS" ||
    value === "PARTICULAR"
  );
}

function isSearchSource(
  value: unknown
): value is NonNullable<PrescriptionMedication["search_source"]> {
  return value === "catalog" || value === "pami" || value === "generic" || value === "manual";
}

export function parsePrescriptionMedications(value: unknown): PrescriptionMedication[] {
  if (!Array.isArray(value)) return [];
  const out: PrescriptionMedication[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const genericName = Reflect.get(item, "generic_name");
    const posology = Reflect.get(item, "posology");
    const quantityRaw = Reflect.get(item, "quantity");
    if (typeof genericName !== "string" || typeof posology !== "string") continue;
    const quantity =
      typeof quantityRaw === "number" ? quantityRaw : Number(quantityRaw);
    if (!Number.isFinite(quantity)) continue;

    const med: PrescriptionMedication = {
      generic_name: genericName,
      quantity,
      posology,
    };

    const brandName = Reflect.get(item, "brand_name");
    if (typeof brandName === "string") med.brand_name = brandName;
    const presentation = Reflect.get(item, "presentation");
    if (typeof presentation === "string") med.presentation = presentation;
    const concentration = Reflect.get(item, "concentration");
    if (typeof concentration === "string") med.concentration = concentration;
    const route = Reflect.get(item, "route");
    if (typeof route === "string") med.route = route;
    const prolonged = Reflect.get(item, "prolonged_treatment");
    if (typeof prolonged === "boolean") med.prolonged_treatment = prolonged;
    const activeIngredient = Reflect.get(item, "active_ingredient");
    if (typeof activeIngredient === "string") med.active_ingredient = activeIngredient;
    const pharmaceuticalForm = Reflect.get(item, "pharmaceutical_form");
    if (typeof pharmaceuticalForm === "string") med.pharmaceutical_form = pharmaceuticalForm;
    const dose = Reflect.get(item, "dose");
    if (typeof dose === "string") med.dose = dose;
    const frequency = Reflect.get(item, "frequency");
    if (typeof frequency === "string") med.frequency = frequency;
    const durationDays = Reflect.get(item, "duration_days");
    if (typeof durationDays === "number") med.duration_days = durationDays;
    const instructions = Reflect.get(item, "instructions");
    if (typeof instructions === "string") med.instructions = instructions;
    const vademecumCode = Reflect.get(item, "vademecum_code");
    if (typeof vademecumCode === "string") med.vademecum_code = vademecumCode;
    const searchSource = Reflect.get(item, "search_source");
    if (isSearchSource(searchSource)) med.search_source = searchSource;

    out.push(med);
  }
  return out;
}

type PrescriptionDraftRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  clinical_record_id: string | null;
  professional_id: string;
  medications: unknown;
  notes: string | null;
  disclaimer_accepted: boolean;
  prescription_type: string;
  diagnosis_cie10: string | null;
  diagnosis_text: string | null;
  status: string;
  prescription_number: string | null;
  issued_at: string | null;
  validity_days: number;
  refeps_status: string;
  refeps_id: string | null;
  refeps_submitted_at?: string | null;
  refeps_error?: string | null;
  refeps_payload?: unknown;
  digital_signature_hash?: string | null;
  patient_insurance: string | null;
  coverage_kind: string | null;
  insurance_number: string | null;
  insurance_plan: string | null;
  idempotency_key: string | null;
  dispensed_at: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function payloadRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = entry;
  }
  return out;
}

/** Map a prescription_drafts row (Json medications) into the domain type. */
export function toElectronicPrescription(row: PrescriptionDraftRow): ElectronicPrescription | null {
  if (!isPrescriptionType(row.prescription_type)) return null;
  if (!isPrescriptionStatus(row.status)) return null;
  if (!isRefepsStatus(row.refeps_status)) return null;
  if (!isCoverageKind(row.coverage_kind)) return null;

  return {
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    clinical_record_id: row.clinical_record_id,
    professional_id: row.professional_id,
    medications: parsePrescriptionMedications(row.medications),
    notes: row.notes,
    disclaimer_accepted: row.disclaimer_accepted,
    prescription_type: row.prescription_type,
    diagnosis_cie10: row.diagnosis_cie10,
    diagnosis_text: row.diagnosis_text,
    status: row.status,
    prescription_number: row.prescription_number,
    issued_at: row.issued_at,
    validity_days: row.validity_days,
    refeps_status: row.refeps_status,
    refeps_id: row.refeps_id,
    refeps_submitted_at: row.refeps_submitted_at,
    refeps_error: row.refeps_error,
    refeps_payload: payloadRecord(row.refeps_payload),
    digital_signature_hash: row.digital_signature_hash,
    patient_insurance: row.patient_insurance,
    coverage_kind: row.coverage_kind,
    insurance_number: row.insurance_number,
    insurance_plan: row.insurance_plan,
    idempotency_key: row.idempotency_key,
    dispensed_at: row.dispensed_at,
    version: row.version,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
