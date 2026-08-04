"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/core/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateWaitingRoomStatus } from "@/lib/actions/waiting-room";
import {
  WAITING_ROOM_STATUSES,
  labelForWaitingRoom,
  type WaitingRoomStatus,
} from "@/lib/constants/cash-register";

export type WaitingRoomRow = {
  id: string;
  start_at: string;
  waiting_room_status: string;
  patients: { first_name: string; last_name: string; document_number: string } | null;
  professionals: { display_name: string | null; profiles: { full_name: string } | null } | null;
};

const COLUMNS = WAITING_ROOM_STATUSES.filter((s) =>
  ["waiting", "confirmed", "in_consultation", "finished"].includes(s.value)
);

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
        () => router.refresh()
      )
      .subscribe();

    const poll = setInterval(() => router.refresh(), 30000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [clinicId, router]);

  function move(id: string, status: WaitingRoomStatus) {
    startTransition(async () => {
      await updateWaitingRoomStatus(id, status);
      router.refresh();
    });
  }

  const byStatus = (status: string) =>
    rows.filter((r) => r.waiting_room_status === status && !["cancelled", "absent"].includes(r.waiting_room_status));

  const issues = rows.filter((r) => ["cancelled", "absent"].includes(r.waiting_room_status));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <Card key={col.value} title={col.label} className="min-h-[200px]">
            <ul className="space-y-2">
              {byStatus(col.value).map((r) => {
                const p = r.patients;
                const pro =
                  r.professionals?.display_name ??
                  r.professionals?.profiles?.full_name ??
                  "Profesional";
                return (
                  <li
                    key={r.id}
                    className="rounded-lg border border-slate-600/40 bg-slate-900/30 p-3 text-sm"
                  >
                    <p className="font-semibold">
                      {p ? `${p.last_name}, ${p.first_name}` : "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(r.start_at), "HH:mm", { locale: es })} · DNI {p?.document_number} · {pro}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {col.value === "waiting" && (
                        <>
                          <Button size="sm" type="button" disabled={pending} onClick={() => move(r.id, "confirmed")}>
                            Confirmar
                          </Button>
                          <Button size="sm" variant="outline" type="button" disabled={pending} onClick={() => move(r.id, "absent")}>
                            Ausente
                          </Button>
                        </>
                      )}
                      {col.value === "confirmed" && (
                        <Button size="sm" type="button" disabled={pending} onClick={() => move(r.id, "in_consultation")}>
                          A consultorio
                        </Button>
                      )}
                      {col.value === "in_consultation" && (
                        <Button size="sm" type="button" disabled={pending} onClick={() => move(r.id, "finished")}>
                          Finalizar
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
              {byStatus(col.value).length === 0 && (
                <p className="text-xs text-slate-500">Sin pacientes</p>
              )}
            </ul>
          </Card>
        ))}
      </div>

      {issues.length > 0 && (
        <Card title="Cancelados / Ausentes">
          <ul className="text-sm">
            {issues.map((r) => (
              <li key={r.id} className="py-1">
                {r.patients?.last_name}, {r.patients?.first_name} —{" "}
                {labelForWaitingRoom(r.waiting_room_status)}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
