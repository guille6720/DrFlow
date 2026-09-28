"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { revalidateMedicalOrderSurfaces } from "@/core/cache/revalidate-medical-order-surfaces";
import { hasPermission } from "@/core/permissions/roles";
import { recordAudit } from "@/core/security/audit-service";
import type { AuditAction } from "@/core/security/audit-types";
import { getPublicSiteUrl } from "@/core/supabase/env";
import { createClient } from "@/core/supabase/server";

import {
  MEDICAL_ORDER_AUDIT_EVENTS,
  MEDICAL_ORDER_CATEGORIES,
  MEDICAL_ORDER_CATEGORY_LEGACY_TYPE,
  MEDICAL_ORDER_STATUS_LABELS,
  type MedicalOrderClientEvent,
  type MedicalOrderStatusV2,
} from "@/features/ordenes-medicas/constants";
import {
  queryMedicalOrderCatalog,
  queryMedicalOrderDetail,
  queryMedicalOrders,
} from "@/features/ordenes-medicas/server/medical-orders.server";
import type {
  MedicalOrderCatalogEntry,
  MedicalOrderDetail,
  MedicalOrderFilters,
  MedicalOrderListRow,
} from "@/features/ordenes-medicas/types";
import {
  buildItemMetadata,
  buildMedicalOrderVerifyUrl,
  categoryLabel,
  composeMedicalOrderText,
  isMissingSchemaError,
  mapMedicalOrderDbError,
} from "@/features/ordenes-medicas/utils/medical-order-format";
import {
  cancelMedicalOrderSchema,
  type MedicalOrderInput,
  type MedicalOrderInputRaw,
  medicalOrderInputSchema,
  shareMedicalOrderEmailSchema,
} from "@/features/ordenes-medicas/validation";

import { resolveSessionProfessionalId } from "@/lib/server/resolve-default-professional";
import { sendTransactionalEmail } from "@/lib/services/transactional-email";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SCHEMA_NOT_READY =
  "El módulo de órdenes médicas todavía no está habilitado en este entorno.";

async function untypedClient(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

function firstZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

async function auditOrderEvent(params: {
  clinicId: string;
  orderId: string;
  patientId: string;
  action: AuditAction;
  event: (typeof MEDICAL_ORDER_AUDIT_EVENTS)[keyof typeof MEDICAL_ORDER_AUDIT_EVENTS];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Metadata carries identifiers only (no PHI: no order text, names or diagnoses).
  await recordAudit({
    clinicId: params.clinicId,
    module: "orders",
    entityType: "medical_order",
    entityId: params.orderId,
    patientId: params.patientId,
    action: params.action,
    what: params.event,
    metadata: { event: params.event, ...params.metadata },
  });
}

function revalidateOrderViews(patientId: string, clinicalRecordId?: string | null): void {
  revalidateMedicalOrderSurfaces({ patientId, clinicalRecordId: clinicalRecordId ?? null });
  revalidatePath("/ordenes-medicas", "page");
}

function buildOrderRow(input: MedicalOrderInput, orderText: string) {
  return {
    order_text: orderText,
    order_type: MEDICAL_ORDER_CATEGORY_LEGACY_TYPE[input.category],
    order_category: input.category,
    clinical_record_id: input.clinical_record_id ?? null,
    diagnosis_text: input.diagnosis_text,
    diagnosis_code: input.diagnosis_code,
    clinical_indication: input.clinical_indication,
    preparation_instructions: input.preparation_instructions,
    notes: input.notes,
    priority: input.priority,
    valid_until: input.valid_until,
  };
}

async function replaceItems(
  db: SupabaseClient,
  clinicId: string,
  orderId: string,
  input: MedicalOrderInput
): Promise<string | null> {
  const { error: delError } = await db
    .from("medical_order_items")
    .delete()
    .eq("medical_order_id", orderId)
    .eq("clinic_id", clinicId);
  if (delError) return delError.message;
  const rows = input.items.map((item, index) => ({
    clinic_id: clinicId,
    medical_order_id: orderId,
    category: input.category,
    code: item.code,
    name: item.name,
    description: item.description,
    metadata: buildItemMetadata(item),
    sort_order: index,
  }));
  const { error } = await db.from("medical_order_items").insert(rows);
  return error ? error.message : null;
}

async function issueOrder(
  db: SupabaseClient,
  clinicId: string,
  orderId: string
): Promise<ActionResult<{ order_number: string | null }>> {
  const { data, error } = await db
    .from("medical_orders")
    .update({ status: "issued" })
    .eq("id", orderId)
    .eq("clinic_id", clinicId)
    .eq("status", "draft")
    .select("order_number")
    .maybeSingle();
  if (error) return { ok: false, error: mapMedicalOrderDbError(error.message) };
  if (!data) return { ok: false, error: "La orden ya no está en borrador." };
  return { ok: true, data: { order_number: (data as { order_number: string | null }).order_number } };
}

/** Creates a medical order as draft, optionally issuing it immediately (number + QR + hash). */
export async function createMedicalOrderV2(
  raw: MedicalOrderInputRaw,
  mode: "draft" | "issue"
): Promise<ActionResult<{ id: string; status: MedicalOrderStatusV2; order_number: string | null }>> {
  const access = await requireClinicPermission("issueMedicalOrders");
  if (!access.ok) return { ok: false, error: "No tenés permiso para emitir órdenes médicas." };

  const parsed = medicalOrderInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  const db = await untypedClient();
  const professionalId = await resolveSessionProfessionalId(db, access.clinicId, access.userId);
  if (!professionalId) {
    return {
      ok: false,
      error: "Tu usuario no tiene un perfil profesional en este consultorio. Solo profesionales pueden emitir órdenes.",
    };
  }

  const { data: patient } = await db
    .from("patients")
    .select("id")
    .eq("id", input.patient_id)
    .eq("clinic_id", access.clinicId)
    .maybeSingle();
  if (!patient) return { ok: false, error: "Paciente no encontrado en este consultorio." };

  if (input.idempotency_key) {
    const { data: existing } = await db
      .from("medical_orders")
      .select("id, status, order_number")
      .eq("clinic_id", access.clinicId)
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle();
    if (existing) {
      const row = existing as { id: string; status: MedicalOrderStatusV2; order_number: string | null };
      return { ok: true, data: row };
    }
  }

  const orderText = composeMedicalOrderText(input);
  const { data: inserted, error: insertError } = await db
    .from("medical_orders")
    .insert({
      ...buildOrderRow(input, orderText),
      clinic_id: access.clinicId,
      patient_id: input.patient_id,
      professional_id: professionalId,
      status: "draft",
      created_by: access.userId,
      idempotency_key: input.idempotency_key ?? null,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    if (isMissingSchemaError(insertError)) return { ok: false, error: SCHEMA_NOT_READY };
    return { ok: false, error: mapMedicalOrderDbError(insertError?.message) };
  }
  const orderId = (inserted as { id: string }).id;

  const itemsError = await replaceItems(db, access.clinicId, orderId, input);
  if (itemsError) {
    return { ok: false, error: "La orden quedó como borrador pero no se pudieron guardar los estudios." };
  }

  let status: MedicalOrderStatusV2 = "draft";
  let orderNumber: string | null = null;
  if (mode === "issue") {
    const issued = await issueOrder(db, access.clinicId, orderId);
    if (!issued.ok) {
      revalidateOrderViews(input.patient_id, input.clinical_record_id);
      return { ok: false, error: `${issued.error} La orden quedó guardada como borrador.` };
    }
    status = "issued";
    orderNumber = issued.data.order_number;
  }

  await auditOrderEvent({
    clinicId: access.clinicId,
    orderId,
    patientId: input.patient_id,
    action: "create",
    event: MEDICAL_ORDER_AUDIT_EVENTS.created,
    metadata: { category: input.category, status, order_number: orderNumber, items: input.items.length },
  });

  revalidateOrderViews(input.patient_id, input.clinical_record_id);
  return { ok: true, data: { id: orderId, status, order_number: orderNumber } };
}

async function loadDraftForMutation(db: SupabaseClient, clinicId: string, orderId: string) {
  const { data } = await db
    .from("medical_orders")
    .select("id, status, patient_id, clinical_record_id, order_category")
    .eq("id", orderId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const row = data as {
    id: string;
    status: string;
    patient_id: string;
    clinical_record_id: string | null;
    order_category: string | null;
  } | null;
  if (!row || !row.order_category) return null;
  return row;
}

/** Edits a draft (issued orders are immutable — enforced again by DB trigger). */
export async function updateMedicalOrderDraft(
  orderId: string,
  raw: MedicalOrderInputRaw,
  issueAfterSave = false
): Promise<ActionResult<{ id: string; status: MedicalOrderStatusV2; order_number: string | null }>> {
  const access = await requireClinicPermission("issueMedicalOrders");
  if (!access.ok) return { ok: false, error: "No tenés permiso para editar órdenes médicas." };
  if (!UUID_RE.test(orderId)) return { ok: false, error: "Orden inválida" };

  const parsed = medicalOrderInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  const db = await untypedClient();
  const draft = await loadDraftForMutation(db, access.clinicId, orderId);
  if (!draft) return { ok: false, error: "Orden no encontrada." };
  if (draft.status !== "draft") {
    return { ok: false, error: "La orden ya fue emitida y no puede modificarse. Solo puede anularse." };
  }
  if (draft.patient_id !== input.patient_id) return { ok: false, error: "La orden pertenece a otro paciente." };

  const { error } = await db
    .from("medical_orders")
    .update(buildOrderRow(input, composeMedicalOrderText(input)))
    .eq("id", orderId)
    .eq("clinic_id", access.clinicId)
    .eq("status", "draft");
  if (error) return { ok: false, error: mapMedicalOrderDbError(error.message) };

  const itemsError = await replaceItems(db, access.clinicId, orderId, input);
  if (itemsError) return { ok: false, error: "No se pudieron guardar los estudios del borrador." };

  let status: MedicalOrderStatusV2 = "draft";
  let orderNumber: string | null = null;
  if (issueAfterSave) {
    const issued = await issueOrder(db, access.clinicId, orderId);
    if (!issued.ok) return { ok: false, error: issued.error };
    status = "issued";
    orderNumber = issued.data.order_number;
    await auditOrderEvent({
      clinicId: access.clinicId,
      orderId,
      patientId: draft.patient_id,
      action: "update",
      event: MEDICAL_ORDER_AUDIT_EVENTS.created,
      metadata: { category: input.category, status, order_number: orderNumber, from_draft: true },
    });
  }

  revalidateOrderViews(draft.patient_id, draft.clinical_record_id);
  return { ok: true, data: { id: orderId, status, order_number: orderNumber } };
}

/** Discards a draft (never allowed for issued orders; DB trigger blocks it too). */
export async function discardMedicalOrderDraft(orderId: string): Promise<ActionResult<null>> {
  const access = await requireClinicPermission("issueMedicalOrders");
  if (!access.ok) return { ok: false, error: "Sin permisos" };
  if (!UUID_RE.test(orderId)) return { ok: false, error: "Orden inválida" };
  const db = await untypedClient();
  const draft = await loadDraftForMutation(db, access.clinicId, orderId);
  if (!draft || draft.status !== "draft") return { ok: false, error: "Solo se pueden descartar borradores." };
  const { error } = await db
    .from("medical_orders")
    .delete()
    .eq("id", orderId)
    .eq("clinic_id", access.clinicId)
    .eq("status", "draft");
  if (error) return { ok: false, error: mapMedicalOrderDbError(error.message) };
  revalidateOrderViews(draft.patient_id, draft.clinical_record_id);
  return { ok: true, data: null };
}

/** Annuls an issued order. It stays in the history as ANULADA with reason, user and timestamp. */
export async function cancelMedicalOrderV2(orderId: string, reason: string): Promise<ActionResult<null>> {
  const access = await requireClinicPermission("cancelMedicalOrders");
  if (!access.ok) return { ok: false, error: "No tenés permiso para anular órdenes médicas." };

  const parsed = cancelMedicalOrderSchema.safeParse({ order_id: orderId, reason });
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const db = await untypedClient();
  const { data } = await db
    .from("medical_orders")
    .select("id, status, patient_id, clinical_record_id, order_category, order_number")
    .eq("id", parsed.data.order_id)
    .eq("clinic_id", access.clinicId)
    .maybeSingle();
  const row = data as {
    id: string;
    status: string;
    patient_id: string;
    clinical_record_id: string | null;
    order_category: string | null;
    order_number: string | null;
  } | null;
  if (!row) return { ok: false, error: "Orden no encontrada." };
  if (row.status !== "issued") return { ok: false, error: "Solo se pueden anular órdenes emitidas." };

  const { error } = await db
    .from("medical_orders")
    .update({ status: "void", void_reason: parsed.data.reason })
    .eq("id", row.id)
    .eq("clinic_id", access.clinicId)
    .eq("status", "issued");
  if (error) {
    if (isMissingSchemaError(error)) return { ok: false, error: SCHEMA_NOT_READY };
    return { ok: false, error: mapMedicalOrderDbError(error.message) };
  }

  await auditOrderEvent({
    clinicId: access.clinicId,
    orderId: row.id,
    patientId: row.patient_id,
    action: "delete",
    event: MEDICAL_ORDER_AUDIT_EVENTS.cancelled,
    metadata: { order_number: row.order_number, category: row.order_category, soft_void: true },
  });

  revalidateOrderViews(row.patient_id, row.clinical_record_id);
  return { ok: true, data: null };
}

function parseFilters(raw: MedicalOrderFilters): MedicalOrderFilters {
  const out: MedicalOrderFilters = {};
  if (raw.patientId && UUID_RE.test(raw.patientId)) out.patientId = raw.patientId;
  if (raw.professionalId && UUID_RE.test(raw.professionalId)) out.professionalId = raw.professionalId;
  if (raw.category && (MEDICAL_ORDER_CATEGORIES as readonly string[]).includes(raw.category)) {
    out.category = raw.category;
  }
  if (raw.status && raw.status in MEDICAL_ORDER_STATUS_LABELS) out.status = raw.status;
  if (raw.from && /^\d{4}-\d{2}-\d{2}$/.test(raw.from)) out.from = raw.from;
  if (raw.to && /^\d{4}-\d{2}-\d{2}$/.test(raw.to)) out.to = raw.to;
  if (raw.q) out.q = String(raw.q).slice(0, 80);
  if (raw.limit) out.limit = Number(raw.limit) || undefined;
  return out;
}

export async function listMedicalOrdersAction(
  filters: MedicalOrderFilters
): Promise<ActionResult<{ rows: MedicalOrderListRow[]; schemaReady: boolean }>> {
  const access = await requireClinicPermission("viewMedicalOrders");
  if (!access.ok) return { ok: false, error: "Sin permisos para ver órdenes médicas." };
  const db = await untypedClient();
  const result = await queryMedicalOrders(db, access.clinicId, parseFilters(filters));
  return { ok: true, data: result };
}

export async function getMedicalOrderDetailAction(orderId: string): Promise<ActionResult<MedicalOrderDetail>> {
  const access = await requireClinicPermission("viewMedicalOrders");
  if (!access.ok) return { ok: false, error: "Sin permisos para ver órdenes médicas." };
  if (!UUID_RE.test(orderId)) return { ok: false, error: "Orden inválida" };
  const db = await untypedClient();
  const detail = await queryMedicalOrderDetail(db, access.clinicId, orderId);
  if (!detail) return { ok: false, error: "Orden no encontrada." };
  await auditOrderEvent({
    clinicId: access.clinicId,
    orderId,
    patientId: detail.patient_id,
    action: "view",
    event: MEDICAL_ORDER_AUDIT_EVENTS.viewed,
    metadata: { order_number: detail.order_number },
  });
  return { ok: true, data: detail };
}

/** Audit hook for client-side actions (PDF, print, copy link, WhatsApp). */
export async function recordMedicalOrderEvent(
  orderId: string,
  event: MedicalOrderClientEvent
): Promise<ActionResult<null>> {
  const permission = event === "viewed" ? "viewMedicalOrders" : "shareMedicalOrders";
  const access = await requireClinicPermission(permission);
  if (!access.ok) return { ok: false, error: "Sin permisos" };
  if (!UUID_RE.test(orderId)) return { ok: false, error: "Orden inválida" };
  const db = await untypedClient();
  const { data } = await db
    .from("medical_orders")
    .select("id, patient_id, status")
    .eq("id", orderId)
    .eq("clinic_id", access.clinicId)
    .maybeSingle();
  const row = data as { id: string; patient_id: string; status: string } | null;
  if (!row) return { ok: false, error: "Orden no encontrada." };

  const auditEvent =
    event === "viewed"
      ? MEDICAL_ORDER_AUDIT_EVENTS.viewed
      : event === "pdf" || event === "print"
        ? MEDICAL_ORDER_AUDIT_EVENTS.pdfGenerated
        : MEDICAL_ORDER_AUDIT_EVENTS.shared;
  await auditOrderEvent({
    clinicId: access.clinicId,
    orderId,
    patientId: row.patient_id,
    action: event === "viewed" ? "view" : "export",
    event: auditEvent,
    metadata: { channel: event },
  });
  return { ok: true, data: null };
}

async function requestOrigin(): Promise<string | undefined> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return undefined;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Emails the secure verification link (no clinical content in the email body). */
export async function sendMedicalOrderEmail(orderId: string, email: string): Promise<ActionResult<null>> {
  const access = await requireClinicPermission("shareMedicalOrders");
  if (!access.ok) return { ok: false, error: "Sin permisos para compartir órdenes." };
  const parsed = shareMedicalOrderEmailSchema.safeParse({ order_id: orderId, email });
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

  const db = await untypedClient();
  const detail = await queryMedicalOrderDetail(db, access.clinicId, parsed.data.order_id);
  if (!detail || !detail.isV2 || !detail.public_verification_token) {
    return { ok: false, error: "Solo se pueden enviar órdenes emitidas con el módulo nuevo." };
  }
  if (detail.status !== "issued") return { ok: false, error: "La orden no está vigente." };

  const origin = await requestOrigin();
  const url = buildMedicalOrderVerifyUrl(
    origin && !origin.includes("localhost") ? origin : getPublicSiteUrl(origin),
    detail.public_verification_token
  );
  const clinicName = detail.issuer_snapshot?.clinic_name ?? "el consultorio";
  const subject = `Orden médica ${detail.order_number ?? ""} — ${clinicName}`.trim();
  const text = [
    `Recibiste una orden médica (${categoryLabel(detail.order_category)}) emitida por ${clinicName}.`,
    `N.º de orden: ${detail.order_number ?? "—"}`,
    "",
    `Podés verificar su validez en: ${url}`,
    "",
    "Presentá la orden impresa o este enlace en el centro de atención.",
  ].join("\n");
  const html = `<p>Recibiste una orden médica (${categoryLabel(detail.order_category)}) emitida por <strong>${escapeHtml(clinicName)}</strong>.</p><p>N.º de orden: <strong>${escapeHtml(detail.order_number ?? "—")}</strong></p><p><a href="${url}">Verificar orden médica</a></p><p style="color:#64748b;font-size:12px">Presentá la orden impresa o este enlace en el centro de atención.</p>`;

  const result = await sendTransactionalEmail({ to: parsed.data.email, subject, text, html });
  if (!result.sent) return { ok: false, error: "El envío de emails no está configurado o falló." };

  await auditOrderEvent({
    clinicId: access.clinicId,
    orderId: detail.id,
    patientId: detail.patient_id,
    action: "export",
    event: MEDICAL_ORDER_AUDIT_EVENTS.shared,
    metadata: { channel: "email", order_number: detail.order_number },
  });
  return { ok: true, data: null };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type MedicalOrderFormContext = {
  canIssue: boolean;
  issueBlockedReason: string | null;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    document_type: string | null;
    document_number: string | null;
    birth_date: string | null;
    sex: string | null;
    insurance_provider: string | null;
    insurance_plan: string | null;
    insurance_number: string | null;
  };
  professional: {
    name: string;
    specialty: string | null;
    license: string | null;
    licenseType: string | null;
  } | null;
  clinic: { name: string; address: string | null; phone: string | null; email: string | null };
  diagnoses: { name: string; cie10_code: string | null }[];
  catalog: MedicalOrderCatalogEntry[];
};

/** Auto-loaded data for the new-order form (patient, issuer, clinic, diagnoses, catalog). */
export async function getMedicalOrderFormContext(
  patientId: string
): Promise<ActionResult<MedicalOrderFormContext>> {
  const access = await requireClinicPermission("viewMedicalOrders");
  if (!access.ok) return { ok: false, error: "Sin permisos" };
  if (!UUID_RE.test(patientId)) return { ok: false, error: "Paciente inválido" };

  const db = await untypedClient();
  const [patientRes, clinicRes, diagnosesRes, catalog, professionalId] = await Promise.all([
    db
      .from("patients")
      .select(
        "id, first_name, last_name, document_type, document_number, birth_date, sex, insurance_provider, insurance_plan, insurance_number"
      )
      .eq("id", patientId)
      .eq("clinic_id", access.clinicId)
      .maybeSingle(),
    db.from("clinics").select("name, address, phone, email").eq("id", access.clinicId).maybeSingle(),
    db
      .from("clinical_record_diagnoses")
      .select("name, cie10_code, created_at")
      .eq("clinic_id", access.clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(30),
    queryMedicalOrderCatalog(db, access.clinicId),
    resolveSessionProfessionalId(db, access.clinicId, access.userId),
  ]);

  if (!patientRes.data) return { ok: false, error: "Paciente no encontrado." };

  let professional: MedicalOrderFormContext["professional"] = null;
  if (professionalId) {
    const { data: pro } = await db
      .from("professionals")
      .select("display_name, license_number, license_national, license_provincial, specialties(name), profiles(full_name)")
      .eq("id", professionalId)
      .eq("clinic_id", access.clinicId)
      .maybeSingle();
    if (pro) {
      const p = pro as {
        display_name: string | null;
        license_number: string | null;
        license_national: string | null;
        license_provincial: string | null;
        specialties?: { name: string } | { name: string }[] | null;
        profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
      };
      const specialty = Array.isArray(p.specialties) ? p.specialties[0] : p.specialties;
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const license = p.license_national || p.license_provincial || p.license_number || null;
      professional = {
        name: p.display_name?.trim() || profile?.full_name?.trim() || "Profesional",
        specialty: specialty?.name ?? null,
        license,
        licenseType: p.license_national ? "MN" : p.license_provincial ? "MP" : license ? "Mat." : null,
      };
    }
  }

  const canIssuePermission = hasPermission(
    access.role,
    "issueMedicalOrders",
    false,
    access.permissionOverrides
  );
  let issueBlockedReason: string | null = null;
  if (!canIssuePermission) issueBlockedReason = "Tu rol no tiene permiso para emitir órdenes médicas.";
  else if (!professional) {
    issueBlockedReason =
      "Tu usuario no tiene un perfil profesional vinculado en este consultorio. Solo el profesional titular puede emitir.";
  }

  const seen = new Set<string>();
  const diagnoses = ((diagnosesRes.data ?? []) as { name: string; cie10_code: string | null }[])
    .filter((d) => {
      const key = `${d.name}|${d.cie10_code ?? ""}`.toLowerCase();
      if (!d.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((d) => ({ name: d.name, cie10_code: d.cie10_code }));

  const clinic = (clinicRes.data ?? { name: "Consultorio" }) as MedicalOrderFormContext["clinic"];
  return {
    ok: true,
    data: {
      canIssue: issueBlockedReason === null,
      issueBlockedReason,
      patient: patientRes.data as MedicalOrderFormContext["patient"],
      professional,
      clinic: {
        name: clinic.name,
        address: clinic.address ?? null,
        phone: clinic.phone ?? null,
        email: clinic.email ?? null,
      },
      diagnoses,
      catalog,
    },
  };
}

/** Patient picker for "+ Nueva orden médica" from the global screen (clinic-scoped). */
export async function searchPatientsForMedicalOrder(
  q: string
): Promise<ActionResult<{ id: string; name: string; document: string | null }[]>> {
  const access = await requireClinicPermission("issueMedicalOrders");
  if (!access.ok) return { ok: false, error: "Sin permisos" };
  const term = q.replace(/[%,()*\\]/g, " ").trim().slice(0, 60);
  if (term.length < 2) return { ok: true, data: [] };
  const db = await untypedClient();
  const { data } = await db
    .from("patients")
    .select("id, first_name, last_name, document_number")
    .eq("clinic_id", access.clinicId)
    .or(`last_name.ilike.%${term}%,first_name.ilike.%${term}%,document_number.ilike.%${term}%`)
    .order("last_name", { ascending: true })
    .limit(10);
  return {
    ok: true,
    data: ((data ?? []) as { id: string; first_name: string; last_name: string; document_number: string | null }[]).map(
      (p) => ({ id: p.id, name: `${p.last_name}, ${p.first_name}`, document: p.document_number })
    ),
  };
}

export async function getMedicalOrderPermissions(): Promise<{
  canView: boolean;
  canIssue: boolean;
  canCancel: boolean;
  canShare: boolean;
}> {
  const view = await requireClinicPermission("viewMedicalOrders");
  if (!view.ok) return { canView: false, canIssue: false, canCancel: false, canShare: false };
  const has = (key: "issueMedicalOrders" | "cancelMedicalOrders" | "shareMedicalOrders") =>
    hasPermission(view.role, key, view.isSuperadmin, view.permissionOverrides);
  return {
    canView: true,
    canIssue: has("issueMedicalOrders"),
    canCancel: has("cancelMedicalOrders"),
    canShare: has("shareMedicalOrders"),
  };
}