import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { createClient } from "@/core/supabase/server";
import { waitingRoomStatusSchema } from "@/core/validations/cash-schemas";

export const dynamic = "force-dynamic";

const CLINIC_COOKIE = "drflow_clinic_id";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WAITING_ROOM_ROLES = new Set(["superadmin", "clinic_admin", "doctor", "secretary"]);

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
 * Minimal waiting-room status endpoint — no server actions, no revalidatePath.
 * Avoids post-action RSC refresh that crashes /turnos/agenda in production.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden", v: "waiting-room-v1" }, { status: 403 });
  }

  let body: { appointmentId?: unknown; status?: unknown };
  try {
    body = (await request.json()) as { appointmentId?: unknown; status?: unknown };
  } catch {
    return NextResponse.json({ error: "Solicitud inválida", v: "waiting-room-v1" }, { status: 400 });
  }

  const appointmentId =
    typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";
  const statusParsed = waitingRoomStatusSchema.safeParse(body.status);

  if (!appointmentId || !UUID_RE.test(appointmentId)) {
    return NextResponse.json({ error: "Turno inválido", v: "waiting-room-v1" }, { status: 400 });
  }
  if (!statusParsed.success) {
    return NextResponse.json({ error: "Estado inválido", v: "waiting-room-v1" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado", v: "waiting-room-v1" }, { status: 401 });
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
        { error: memberError.message || "No se pudo verificar el acceso", v: "waiting-room-v1" },
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
        return NextResponse.json({ error: "Sin permisos", v: "waiting-room-v1" }, { status: 403 });
      }
      if (!clinicId) {
        return NextResponse.json({ error: "Sin clínica activa", v: "waiting-room-v1" }, { status: 403 });
      }
    } else {
      if (!clinicId || !members.some((m) => m.clinic_id === clinicId)) {
        clinicId = members[0]?.clinic_id ?? null;
      }
      if (!clinicId) {
        return NextResponse.json({ error: "Sin clínica activa", v: "waiting-room-v1" }, { status: 403 });
      }
      const membership = members.find((m) => m.clinic_id === clinicId);
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .maybeSingle();
      const allowed =
        Boolean(profile?.is_superadmin) ||
        (membership?.role != null && WAITING_ROOM_ROLES.has(membership.role));
      if (!allowed) {
        return NextResponse.json({ error: "Sin permisos", v: "waiting-room-v1" }, { status: 403 });
      }
    }

    const { data, error } = await supabase.rpc("update_waiting_room_status_atomic", {
      p_clinic_id: clinicId,
      p_appointment_id: appointmentId,
      p_waiting_room_status: statusParsed.data,
    });

    if (error) {
      return NextResponse.json(
        {
          error: resolvePostgresUserMessage(error, { fallback: error.message }),
          v: "waiting-room-v1",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true as const, data, v: "waiting-room-v1" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo actualizar la asistencia";
    return NextResponse.json(
      { error: `waiting-room-v1: ${message}`, v: "waiting-room-v1" },
      { status: 500 }
    );
  }
}
