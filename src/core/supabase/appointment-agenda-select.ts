import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toAppointmentAgendaRows } from "@/core/supabase/appointment-agenda-map";
import type { AppointmentAgendaRow } from "@/core/supabase/query-types";
import { APPOINTMENT_AGENDA_COLUMNS } from "@/core/supabase/select-columns";

import type { Database } from "@/types/supabase";

/** Columns added by later migrations — drop them if PostgREST reports schema drift. */
const OPTIONAL_AGENDA_COLUMNS = [
  "cancellation_category",
  "waiting_room_entered_at",
  "cancelled_by_type",
  "cancelled_by",
  "cancelled_at",
  "rescheduled_at",
  "is_overbooking",
] as const;

const PATIENT_AGENDA_EMBED =
  "patients(first_name, last_name, document_number, phone, insurance_provider, insurance_plan)";
const PATIENT_AGENDA_EMBED_MIN =
  "patients(first_name, last_name, document_number, phone, insurance_provider)";
const AGENDA_RELATION_EMBEDS =
  "professionals(profiles(full_name)), locations(name), specialties(name)";

function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  column: string
): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    message.includes(`'${column.toLowerCase()}'`) ||
    message.includes(`"${column.toLowerCase()}"`) ||
    message.includes(`column ${column.toLowerCase()}`)
  );
}

function stripOptionalAgendaColumn(columns: string, column: string): string {
  return columns
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== column && !part.startsWith(`${column}(`))
    .join(", ");
}

type AgendaSelectOptions = {
  clinicId: string;
  professionalId?: string;
  rangeStart: string;
  rangeEnd: string;
  embedPatients?: boolean;
  embedRelations?: boolean;
  excludeCancelled?: boolean;
  limit?: number;
  orderAscending?: boolean;
};

/**
 * Loads agenda appointments with graceful fallback when optional columns
 * (cancellation_category, waiting_room_entered_at, …) are missing in the DB.
 */
export async function selectAppointmentAgendaRows(
  supabase: SupabaseClient<Database>,
  options: AgendaSelectOptions
): Promise<{ rows: AppointmentAgendaRow[]; error: string | null }> {
  const parts = [APPOINTMENT_AGENDA_COLUMNS];
  if (options.embedPatients) parts.push(PATIENT_AGENDA_EMBED);
  if (options.embedRelations) parts.push(AGENDA_RELATION_EMBEDS);
  let columns = parts.join(", ");
  let embedPatients = Boolean(options.embedPatients);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    let query = supabase
      .from("appointments")
      .select(columns)
      .eq("clinic_id", options.clinicId)
      .gte("start_at", options.rangeStart)
      .lte("start_at", options.rangeEnd);

    if (options.professionalId) {
      query = query.eq("professional_id", options.professionalId);
    }
    if (options.excludeCancelled) {
      query = query.neq("status", "cancelled");
    }
    query = query.order("start_at", { ascending: options.orderAscending ?? true });
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (!error) {
      return {
        rows: toAppointmentAgendaRows(
          (data ?? []) as unknown as Parameters<typeof toAppointmentAgendaRows>[0]
        ),
        error: null,
      };
    }

    const missingOptional = OPTIONAL_AGENDA_COLUMNS.find((column) =>
      isMissingColumnError(error, column)
    );
    if (missingOptional && columns.split(",").some((part) => part.trim() === missingOptional)) {
      columns = stripOptionalAgendaColumn(columns, missingOptional);
      continue;
    }

    if (embedPatients && isMissingColumnError(error, "insurance_plan")) {
      columns = columns.replace(PATIENT_AGENDA_EMBED, PATIENT_AGENDA_EMBED_MIN);
      embedPatients = false;
      continue;
    }

    return { rows: [], error: error.message };
  }

  return { rows: [], error: "No se pudieron cargar los turnos." };
}
