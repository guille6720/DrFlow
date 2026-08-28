import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { logServerError } from "@/core/errors/log-error.server";
import { userFacingErrorMessage } from "@/core/observability/correlation-id";
import { observeCriticalOperation } from "@/core/observability/observe-critical-operation";
import { getRequestTraceId } from "@/core/observability/request-trace";
import { getAuditRequestContext } from "@/core/security/audit-context";
import { verifyClinicalRecordForeignKeys } from "@/core/security/ownership-guard";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue } from "@/core/validations/params";
import { clinicalRecordSchema } from "@/core/validations/schemas";

import {
  createClinicalRecordEntry,
  updateClinicalRecordEntry,
} from "@/features/historias/services/clinical-records.service";

export const dynamic = "force-dynamic";

const CLINIC_COOKIE = "drflow_clinic_id";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CLINICAL_WRITE_ROLES = new Set(["superadmin", "clinic_admin", "doctor"]);

function sameOrigin(request: NextRequest): boolean {
  const host = request.headers.get("host")?.toLowerCase().replace(/:\d+$/, "");
  if (!host) return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase().replace(/:\d+$/, "") === host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host.toLowerCase().replace(/:\d+$/, "") === host;
    } catch {
      return false;
    }
  }
  return false;
}

type PersistBody = {
  recordId?: unknown;
  consultation_modality?: unknown;
  patient_id?: unknown;
  appointment_id?: unknown;
  professional_id?: unknown;
  chief_complaint?: unknown;
  diagnosis?: unknown;
  evolution?: unknown;
  indications?: unknown;
  professional_signature?: unknown;
  consultation_at?: unknown;
  diagnosis_cie10?: unknown;
  diagnoses_json?: unknown;
  treatments_json?: unknown;
};

/**
 * Persist clinical record (create or update) without server actions / revalidatePath.
 * Avoids post-action RSC refresh that breaks /consultas autosave in production.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden", v: "clinical-persist-v1" }, { status: 403 });
  }

  let body: PersistBody;
  try {
    body = (await request.json()) as PersistBody;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida", v: "clinical-persist-v1" }, { status: 400 });
  }

  const recordId =
    typeof body.recordId === "string" && body.recordId.trim() && UUID_RE.test(body.recordId.trim())
      ? body.recordId.trim()
      : null;

  const parsed = clinicalRecordSchema.safeParse({
    patient_id: body.patient_id,
    appointment_id: body.appointment_id || null,
    professional_id: body.professional_id,
    chief_complaint: body.chief_complaint ?? "",
    diagnosis: body.diagnosis ?? "",
    evolution: body.evolution ?? "",
    indications: body.indications ?? "",
    professional_signature: body.professional_signature ?? "",
    consultation_at: body.consultation_at ?? null,
    diagnosis_cie10: body.diagnosis_cie10 ?? null,
    diagnoses_json: body.diagnoses_json ?? null,
    treatments_json: body.treatments_json ?? null,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodIssue(parsed.error), v: "clinical-persist-v1" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado", v: "clinical-persist-v1" }, { status: 401 });
    }

    const cookieStore = await cookies();
    let clinicId = cookieStore.get(CLINIC_COOKIE)?.value ?? null;

    const { data: memberships, error: memberError } = await supabase
      .from("clinic_members")
      .select("clinic_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message || "No se pudo verificar el acceso", v: "clinical-persist-v1" },
        { status: 500 }
      );
    }

    const members = memberships ?? [];
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle();

    if (members.length === 0) {
      if (!profile?.is_superadmin) {
        return NextResponse.json({ error: "Sin permisos", v: "clinical-persist-v1" }, { status: 403 });
      }
      if (!clinicId) {
        return NextResponse.json({ error: "Sin clínica activa", v: "clinical-persist-v1" }, { status: 403 });
      }
    } else {
      if (!clinicId || !members.some((m) => m.clinic_id === clinicId)) {
        clinicId = members[0]?.clinic_id ?? null;
      }
      if (!clinicId) {
        return NextResponse.json({ error: "Sin clínica activa", v: "clinical-persist-v1" }, { status: 403 });
      }
      const membership = members.find((m) => m.clinic_id === clinicId);
      const allowed =
        Boolean(profile?.is_superadmin) ||
        (membership?.role != null && CLINICAL_WRITE_ROLES.has(membership.role));
      if (!allowed) {
        return NextResponse.json({ error: "Sin permisos", v: "clinical-persist-v1" }, { status: 403 });
      }
    }

    const ownership = await verifyClinicalRecordForeignKeys(supabase, clinicId, {
      patientId: parsed.data.patient_id,
      professionalId: parsed.data.professional_id,
      appointmentId: parsed.data.appointment_id,
      recordId: recordId ?? undefined,
    });
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error, v: "clinical-persist-v1" }, { status: 400 });
    }

    const auditContext = await getAuditRequestContext();

    if (recordId) {
      const result = await observeCriticalOperation(
        "clinical.consultation.save",
        { clinicId, path: "/api/clinical-records/persist" },
        () =>
          updateClinicalRecordEntry(supabase, {
            recordId,
            clinicId,
            userId: user.id,
            parsed: parsed.data,
            auditContext,
          })
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error, v: "clinical-persist-v1" }, { status: 500 });
      }
      return NextResponse.json({
        success: true as const,
        data: { id: recordId },
        v: "clinical-persist-v1",
      });
    }

    const result = await observeCriticalOperation(
      "clinical.consultation.save",
      { clinicId, path: "/api/clinical-records/persist" },
      () =>
        createClinicalRecordEntry(supabase, {
          clinicId,
          userId: user.id,
          parsed: parsed.data,
          consultationModalityRaw: body.consultation_modality,
          auditContext,
        })
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error, v: "clinical-persist-v1" }, { status: 500 });
    }

    return NextResponse.json({
      success: true as const,
      data: { id: String(result.data.id) },
      v: "clinical-persist-v1",
    });
  } catch (err) {
    const traceId = await getRequestTraceId();
    logServerError("clinical.persist", err, {
      path: "/api/clinical-records/persist",
      traceId,
      category: "error",
    });
    const message = userFacingErrorMessage(
      "No se pudo guardar la consulta.",
      traceId
    );
    return NextResponse.json(
      { error: message, v: "clinical-persist-v1" },
      { status: 500 }
    );
  }
}
