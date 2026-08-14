import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/core/supabase/server";

export const dynamic = "force-dynamic";

const CLINIC_COOKIE = "drflow_clinic_id";
  const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORY_LABELS: Record<string, string> = {
  patient: "Paciente",
  professional: "Profesional",
  clinic: "Clínica",
  data_error: "Error de carga",
  other: "Otro",
};

const MANAGE_ROLES = new Set(["superadmin", "clinic_admin", "doctor", "secretary"]);

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

/**
 * Minimal cancel endpoint — no session.cache helpers, no audit, no history,
 * no "use server" imports. Keeps the mutation path free of contaminated graphs.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden", v: "cancel-v4" }, { status: 403 });
  }

  let body: { appointmentId?: unknown; category?: unknown };
  try {
    body = (await request.json()) as { appointmentId?: unknown; category?: unknown };
  } catch {
    return NextResponse.json({ error: "Solicitud inválida", v: "cancel-v4" }, { status: 400 });
  }

  const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";

  if (!appointmentId || !UUID_RE.test(appointmentId)) {
    return NextResponse.json({ error: "Turno inválido", v: "cancel-v4" }, { status: 400 });
  }
  if (!(category in CATEGORY_LABELS)) {
    return NextResponse.json(
      { error: "Motivo de cancelación inválido", v: "cancel-v4" },
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
      return NextResponse.json({ error: "No autenticado", v: "cancel-v4" }, { status: 401 });
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
        { error: memberError.message || "No se pudo verificar el acceso", v: "cancel-v4" },
        { status: 500 }
      );
    }

    const members = memberships ?? [];
    if (members.length === 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.is_superadmin) {
        return NextResponse.json({ error: "Sin permisos", v: "cancel-v4" }, { status: 403 });
      }
      if (!clinicId) {
        return NextResponse.json({ error: "Sin clínica activa", v: "cancel-v4" }, { status: 403 });
      }
    } else {
      if (!clinicId || !members.some((m) => m.clinic_id === clinicId)) {
        clinicId = members[0]?.clinic_id ?? null;
      }
      if (!clinicId) {
        return NextResponse.json({ error: "Sin clínica activa", v: "cancel-v4" }, { status: 403 });
      }
      const membership = members.find((m) => m.clinic_id === clinicId);
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .maybeSingle();
      const allowed =
        Boolean(profile?.is_superadmin) ||
        (membership?.role != null && MANAGE_ROLES.has(membership.role));
      if (!allowed) {
        return NextResponse.json({ error: "Sin permisos", v: "cancel-v4" }, { status: 403 });
      }
    }

    const reason = CATEGORY_LABELS[category] ?? "Otro";

    const { data: before, error: loadError } = await supabase
      .from("appointments")
      .select("id, status, patient_id, start_at, patients(phone)")
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json(
        { error: loadError.message || "No se pudo cargar el turno", v: "cancel-v4" },
        { status: 500 }
      );
    }
    if (!before) {
      return NextResponse.json({ error: "Turno no encontrado", v: "cancel-v4" }, { status: 404 });
    }
    if (before.status === "cancelled") {
      return NextResponse.json(
        { error: "El turno ya está cancelado", v: "cancel-v4" },
        { status: 400 }
      );
    }
    if (before.status === "attended") {
      return NextResponse.json(
        { error: "No se puede cancelar un turno ya atendido", v: "cancel-v4" },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      status: "cancelled",
      cancellation_reason: reason,
      cancellation_category: category,
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancelled_by_type: "clinic",
      waiting_room_status: "cancelled",
    };

    let { error: updateError } = await supabase
      .from("appointments")
      .update(updatePayload)
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId);

    if (updateError && /cancellation_category|waiting_room_status/i.test(updateError.message ?? "")) {
      const { cancellation_category: _c, waiting_room_status: _w, ...fallback } = updatePayload;
      ({ error: updateError } = await supabase
        .from("appointments")
        .update(fallback)
        .eq("id", appointmentId)
        .eq("clinic_id", clinicId));
    }

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "No se pudo cancelar el turno", v: "cancel-v4" },
        { status: 500 }
      );
    }

    const patient = before.patients as
      | { phone?: string | null }
      | { phone?: string | null }[]
      | null;
    const patientRow = Array.isArray(patient) ? patient[0] : patient;

    return NextResponse.json({
      success: true as const,
      v: "cancel-v4",
      whatsapp: patientRow?.phone
        ? {
            phone: patientRow.phone,
            startAt: String(before.start_at),
            reason,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo cancelar el turno";
    return NextResponse.json({ error: `cancel-v4: ${message}`, v: "cancel-v4" }, { status: 500 });
  }
}
