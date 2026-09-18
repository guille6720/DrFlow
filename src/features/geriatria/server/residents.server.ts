import "server-only";

import { asStagingSchemaClient } from "@/core/products/staging-schema-client";
import { createClient } from "@/core/supabase/server";

export type ResidentListItem = {
  id: string;
  status: string;
  admission_date: string | null;
  bed_id: string | null;
  clinical_alerts: string | null;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    document_number: string;
  } | null;
  bed_label: string | null;
};

export type FreeBedOption = {
  id: string;
  code: string;
  label: string | null;
  room_code: string | null;
  room_name: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  activo: "Activo",
  hospitalizado_temporal: "Hospitalizado temporalmente",
  ausencia_temporal: "Ausencia temporal",
  egresado: "Egresado",
  fallecido: "Fallecido",
};

export function residentStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** True while the person has an open/active geriatrics stay (not discharged/deceased). */
export function isOpenResidentStatus(status: string): boolean {
  return status !== "egresado" && status !== "fallecido";
}

/** Patient IDs that already have an open geriatrics resident record in this clinic. */
export async function listOpenResidentPatientIds(
  clinicId: string,
  patientIds?: readonly string[]
): Promise<Set<string>> {
  const supabase = asStagingSchemaClient(await createClient());
  let query = supabase
    .from("geriatrics_residents")
    .select("patient_id, status")
    .eq("clinic_id", clinicId);

  if (patientIds && patientIds.length > 0) {
    query = query.in("patient_id", [...patientIds]);
  }

  const { data } = await query;
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const patientId = String(row.patient_id ?? "");
    const status = String(row.status ?? "");
    if (patientId && isOpenResidentStatus(status)) {
      ids.add(patientId);
    }
  }
  return ids;
}

export async function isPatientOpenResident(
  clinicId: string,
  patientId: string
): Promise<boolean> {
  const ids = await listOpenResidentPatientIds(clinicId, [patientId]);
  return ids.has(patientId);
}

export async function listGeriatricsResidents(clinicId: string): Promise<ResidentListItem[]> {
  const supabase = asStagingSchemaClient(await createClient());
  const typed = await createClient();

  const { data: residents, error } = await supabase
    .from("geriatrics_residents")
    .select(
      "id, status, admission_date, bed_id, clinical_alerts, patient_id, created_at"
    )
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error || !residents?.length) return [];

  const patientIds = [
    ...new Set(
      residents
        .map((r) => String(r.patient_id ?? ""))
        .filter(Boolean)
    ),
  ];
  const bedIds = [
    ...new Set(residents.map((r) => String(r.bed_id ?? "")).filter(Boolean)),
  ];

  const [{ data: patients }, bedsResult] = await Promise.all([
    typed
      .from("patients")
      .select("id, first_name, last_name, document_number")
      .eq("clinic_id", clinicId)
      .in("id", patientIds),
    bedIds.length
      ? supabase
          .from("geriatrics_beds")
          .select("id, code, label, room_id")
          .eq("clinic_id", clinicId)
          .in("id", bedIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null, count: null }),
  ]);

  const bedRows = (bedsResult.data ?? []) as Array<{
    id: string;
    code: string;
    label: string | null;
    room_id: string;
  }>;
  const roomIds = [...new Set(bedRows.map((b) => b.room_id).filter(Boolean))];
  const roomsResult = roomIds.length
    ? await supabase
        .from("geriatrics_rooms")
        .select("id, code, name")
        .eq("clinic_id", clinicId)
        .in("id", roomIds)
    : { data: [] as Record<string, unknown>[] };

  const roomMap = new Map(
    ((roomsResult.data ?? []) as Array<{ id: string; code: string; name: string }>).map((r) => [
      r.id,
      r,
    ])
  );
  const bedMap = new Map(
    bedRows.map((b) => {
      const room = roomMap.get(b.room_id);
      const bedLabel = [room?.code ?? room?.name, b.label ?? b.code].filter(Boolean).join(" · ");
      return [b.id, bedLabel] as const;
    })
  );
  const patientMap = new Map((patients ?? []).map((p) => [p.id, p]));

  return residents.map((r) => {
    const patientId = String(r.patient_id ?? "");
    const bedId = r.bed_id ? String(r.bed_id) : null;
    const patient = patientMap.get(patientId) ?? null;
    return {
      id: String(r.id),
      status: String(r.status ?? "activo"),
      admission_date: r.admission_date ? String(r.admission_date) : null,
      bed_id: bedId,
      clinical_alerts: r.clinical_alerts ? String(r.clinical_alerts) : null,
      patient: patient
        ? {
            id: patient.id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            document_number: patient.document_number,
          }
        : null,
      bed_label: bedId ? bedMap.get(bedId) ?? null : null,
    };
  });
}

export async function listFreeGeriatricsBeds(clinicId: string): Promise<FreeBedOption[]> {
  const supabase = asStagingSchemaClient(await createClient());
  const { data: beds } = await supabase
    .from("geriatrics_beds")
    .select("id, code, label, room_id, status")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .eq("status", "libre")
    .order("code", { ascending: true });

  const bedRows = (beds ?? []) as Array<{
    id: string;
    code: string;
    label: string | null;
    room_id: string;
  }>;
  if (!bedRows.length) return [];

  const roomIds = [...new Set(bedRows.map((b) => b.room_id))];
  const { data: rooms } = await supabase
    .from("geriatrics_rooms")
    .select("id, code, name")
    .eq("clinic_id", clinicId)
    .in("id", roomIds);

  const roomMap = new Map(
    ((rooms ?? []) as Array<{ id: string; code: string; name: string }>).map((r) => [r.id, r])
  );

  return bedRows.map((b) => {
    const room = roomMap.get(b.room_id);
    return {
      id: b.id,
      code: b.code,
      label: b.label,
      room_code: room?.code ?? null,
      room_name: room?.name ?? null,
    };
  });
}
