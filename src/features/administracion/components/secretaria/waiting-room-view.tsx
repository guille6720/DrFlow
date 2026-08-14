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

const COLUMNS = WAITING_ROOM_STATUSES.filter((s) =>
  ["waiting", "confirmed", "in_consultation", "finished"].includes(s.value)
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
    const bucket = byStatus.get(row.waiting_room_status);
    if (bucket) {
      bucket.push(row);
    }
  }

  return { byStatus, issues };
}

const WaitingRoomCard = memo(function WaitingRoomCard({
  row,
  columnValue,
  pending,
  onMove,
  redirectDoctorOnConfirm,
  onGoToConsultas,
}: {
  row: WaitingRoomRow;
  columnValue: string;
  pending: boolean;
  onMove: (id: string, status: WaitingRoomStatus) => void;
  redirectDoctorOnConfirm?: boolean;
  onGoToConsultas?: (id: string) => void;
}) {
  const patient = row.patients;
  const professional =
    row.professionals?.display_name ??
    row.professionals?.profiles?.full_name ??
    "Profesional";

  return (
    <li className="rounded-lg border border-slate-600/40 bg-slate-900/30 p-3 text-sm">
      <p className="font-semibold">{patient ? `${patient.last_name}, ${patient.first_name}` : "—"}</p>
      <p className="text-xs text-slate-500">
        {format(new Date(row.start_at), "HH:mm", { locale: es })} · DNI {patient?.document_number} ·{" "}
        {professional}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {columnValue === "waiting" ? (
          <>
            <Button
              size="sm"
              type="button"
              disabled={pending}
              onClick={() => onMove(row.id, "confirmed")}
            >
              {redirectDoctorOnConfirm ? "Confirmar → Consultas" : "Confirmar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={pending}
              onClick={() => onMove(row.id, "absent")}
            >
              Ausente
            </Button>
          </>
        ) : null}
        {columnValue === "confirmed" ? (
          <>
            <Button
              size="sm"
              type="button"
              disabled={pending}
              onClick={() => onMove(row.id, "in_consultation")}
            >
              A consultorio
            </Button>
            {redirectDoctorOnConfirm && onGoToConsultas ? (
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={pending}
                onClick={() => onGoToConsultas(row.id)}
              >
                Ir a Consultas
              </Button>
            ) : null}
          </>
        ) : null}
        {columnValue === "in_consultation" ? (
          <Button
            size="sm"
            type="button"
            disabled={pending}
            onClick={() => onMove(row.id, "finished")}
          >
            Finalizar
          </Button>
        ) : null}
      </div>
    </li>
  );
});

export function WaitingRoomView({
  clinicId,
  initialRows,
  redirectDoctorOnConfirm = false,
}: {
  clinicId: string;
  initialRows: WaitingRoomRow[];
  /** When true (doctor), Confirmado navigates to Médicos → Consultas. */
  redirectDoctorOnConfirm?: boolean;
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

  const move = useCallback(
    (id: string, status: WaitingRoomStatus) => {
      startTransition(async () => {
        const result = await updateWaitingRoomStatus(id, status);
        if (result?.error) {
          return;
        }
        if (redirectDoctorOnConfirm && status === "confirmed") {
          router.push(`/consultas?appointment=${id}`);
          router.refresh();
          return;
        }
        router.refresh();
      });
    },
    [redirectDoctorOnConfirm, router]
  );

  const { byStatus, issues } = useMemo(() => groupWaitingRoomRows(rows), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                    redirectDoctorOnConfirm={redirectDoctorOnConfirm}
                    onGoToConsultas={(id) => {
                      router.push(`/consultas?appointment=${id}`);
                    }}
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
