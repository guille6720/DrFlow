"use client";

import { useEffect, useState } from "react";

import { cn } from "@/shared/utils/cn";

import {
  formatWaitingRoomElapsed,
  shouldShowWaitingRoomElapsed,
  WAITING_ROOM_ELAPSED_CAP_SECONDS,
  type WaitingRoomStatus,
} from "@/features/turnos/utils/appointment-lifecycle";

type Props = {
  waitingRoomStatus?: WaitingRoomStatus | null;
  enteredAt?: string | null;
  /** When false, hide live timer (e.g. historical agenda days). Default true. */
  enableLiveTimer?: boolean;
};

export function WaitingRoomWaitTimer({
  waitingRoomStatus,
  enteredAt,
  enableLiveTimer = true,
}: Props) {
  const active =
    enableLiveTimer &&
    shouldShowWaitingRoomElapsed({ waitingRoomStatus, enteredAt });
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
  const rawSeconds = Number.isNaN(started) ? 0 : Math.floor((now - started) / 1000);
  if (rawSeconds < 0) {
    return <div className="w-[3.25rem] shrink-0" aria-hidden />;
  }
  const capped = rawSeconds > WAITING_ROOM_ELAPSED_CAP_SECONDS;
  const seconds = Math.min(rawSeconds, WAITING_ROOM_ELAPSED_CAP_SECONDS);
  const longWait = seconds >= 30 * 60;

  return (
    <div
      className="w-[3.25rem] shrink-0 text-center"
      title={
        capped
          ? "Espera prolongada (posible estado pendiente de días anteriores)"
          : "Tiempo en sala de espera"
      }
    >
      <p
        className={cn(
          "font-mono text-sm font-bold tabular-nums",
          longWait || capped ? "text-red-700" : "text-teal-700"
        )}
      >
        {capped ? `>${formatWaitingRoomElapsed(WAITING_ROOM_ELAPSED_CAP_SECONDS)}` : formatWaitingRoomElapsed(seconds)}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        espera
      </p>
    </div>
  );
}
