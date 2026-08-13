"use client";

import { useEffect, useState } from "react";

import { cn } from "@/shared/utils/cn";

import {
  formatWaitingRoomElapsed,
  isWaitingRoomQueueStatus,
  type WaitingRoomStatus,
} from "@/features/turnos/utils/appointment-lifecycle";

type Props = {
  waitingRoomStatus?: WaitingRoomStatus | null;
  enteredAt?: string | null;
};

export function WaitingRoomWaitTimer({ waitingRoomStatus, enteredAt }: Props) {
  const active = isWaitingRoomQueueStatus(waitingRoomStatus) && Boolean(enteredAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, enteredAt]);

  if (!active || !enteredAt) {
    return <div className="w-[3.25rem] shrink-0" aria-hidden />;
  }

  const started = new Date(enteredAt).getTime();
  const seconds = Number.isNaN(started) ? 0 : Math.floor((now - started) / 1000);
  const longWait = seconds >= 30 * 60;

  return (
    <div
      className="w-[3.25rem] shrink-0 text-center"
      title="Tiempo en sala de espera"
    >
      <p
        className={cn(
          "font-mono text-sm font-bold tabular-nums",
          longWait ? "text-red-700" : "text-teal-700"
        )}
      >
        {formatWaitingRoomElapsed(seconds)}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        espera
      </p>
    </div>
  );
}
