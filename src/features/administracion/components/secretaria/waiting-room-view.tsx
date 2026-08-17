"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { createClient } from "@/core/supabase/client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateWaitingRoomStatus } from "@/lib/actions/waiting-room";
import {
  labelForWaitingRoom,
  WAITING_ROOM_STATUSES,
  type WaitingRoomStatus,
} from "@/lib/constants/cash-register";

export type WaitingRoomRow = {
  id: string;
  start_at: string;
  waiting_room_status: string;
  waiting_room_entered_at?: string | null;
  patients: { first_name: string; last_name: string; document_number: string } | null;
  professionals: { display_name: string | null; profiles: { full_name: string } | null } | null;
};

/** Sin columna "En consultorio": confirmado abre Consultas para evolucionar. */
const COLUMNS = WAITING_ROOM_STATUSES.filter((s) =>
  ["waiting", "confirmed", "finished"].includes(s.value)
);

function groupWaitingRoomRows(rows: WaitingRoomRow[]) {
  const byStatus = new Map<string, WaitingRoomRow[]>();
  for (const col of COLUMNS) {
    byStatus.set(col.value, []);
  }

  const issues: WaitingRoomRow[] = [];
  for (const row of rows) {
    if (!row.waiting_room_entered_at) continue;
    if (["cancelled", "absent"].includes(row.waiting_room_status)) {
      issues.push(row);
      continue;
    }
    // Pacientes ya "en consultorio" se muestran en Confirmado (flujo → Consultas).
    const statusKey =
      row.waiting_room_status === "in_consultation" ? "confirmed" : row.waiting_room_status;
    const bucket = byStatus.get(statusKey);
    if (bucket) {
      bucket.push(row);
    }
  }

  return { byStatus, issues };
}

function consultasHref(appointmentId: string) {
  return `/consultas?appointment=${appointmentId}&action=nueva`;
}

const WaitingRoomCard = memo(function WaitingRoomCard({
  row,
  columnValue,
  pending,
  onMove,
  onGoToConsultas,
}: {
  row: WaitingRoomRow;
  columnValue: string;
  pending: boolean;
  onMove: (id: string, status: WaitingRoomStatus) => void;
  onGoToConsultas: (id: string) => void;
}) {
  const patient = row.patients;
  const professional =
    row.professionals?.display_name ??
    row.professionals?.profiles?.full_name ??
    "Profesional";

  return (
    <li className="drflow-card-light rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900">
      <p className="font-semibold text-slate-900">
        {patient ? `${patient.last_name}, ${patient.first_name}` : "—"}
      </p>
      <p className="text-xs text-slate-600">
        {format(new Date(row.start_at), "HH:mm", { locale: es })} · DNI {patient?.document_number} ·{" "}
        {professional}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {columnValue === "waiting" ? (
          <Button
            size="sm"
            type="button"
            loading={pending}
            pendingLabel="Confirmando..."
            onClick={() => onMove(row.id, "confirmed")}
          >
            Confirmar → Consultas
          </Button>
        ) : null}
        {columnValue === "confirmed" ? (
          <Button
            size="sm"
            type="button"
            disabled={pending}
            onClick={() => onGoToConsultas(row.id)}
          >
            Evolucionar
          </Button>
        ) : null}
      </div>
    </li>
  );
});

export function WaitingRoomView({
  clinicId,
  initialRows,
}: {
  clinicId: string;
  initialRows: WaitingRoomRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  const [prevInitialRows, setPrevInitialRows] = useState(initialRows);

  if (initialRows !== prevInitialRows) {
    setPrevInitialRows(initialRows);
    setRows(initialRows);
  }

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, 1500);
    };

    const channel = supabase
      .channel(`waiting-room-${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinicId}`,
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [clinicId, router]);

  const goToConsultas = useCallback(
    (id: string) => {
      router.push(consultasHref(id));
    },
    [router]
  );

  const move = useCallback(
    (id: string, status: WaitingRoomStatus) => {
      startTransition(async () => {
        const result = await updateWaitingRoomStatus(id, status);
        if (result?.error) {
          return;
        }
        if (status === "confirmed") {
          router.push(consultasHref(id));
          return;
        }
        router.refresh();
      });
    },
    [router]
  );

  const { byStatus, issues } = useMemo(() => groupWaitingRoomRows(rows), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {COLUMNS.map((col) => {
          const columnRows = byStatus.get(col.value) ?? [];
          return (
            <Card key={col.value} title={col.label} className="min-h-[200px]">
              <ul className="space-y-2">
                {columnRows.map((row) => (
                  <WaitingRoomCard
                    key={row.id}
                    row={row}
                    columnValue={col.value}
                    pending={pending}
                    onMove={move}
                    onGoToConsultas={goToConsultas}
                  />
                ))}
                {columnRows.length === 0 ? (
                  <p className="text-xs text-slate-500">Sin pacientes</p>
                ) : null}
              </ul>
            </Card>
          );
        })}
      </div>

      {issues.length > 0 ? (
        <Card title="Cancelados / Ausentes">
          <ul className="text-sm">
            {issues.map((row) => (
              <li key={row.id} className="py-1">
                {row.patients?.last_name}, {row.patients?.first_name} —{" "}
                {labelForWaitingRoom(row.waiting_room_status)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
