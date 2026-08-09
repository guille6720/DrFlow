"use client";

import {
  lifecycleLabelToBadgeVariant,
  resolveAppointmentLifecycleLabel,
  type WaitingRoomStatus,
} from "@/features/turnos/utils/appointment-lifecycle";

import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/types/database";

type Props = {
  status: AppointmentStatus;
  waitingRoomStatus?: WaitingRoomStatus | null;
  isOverbooking?: boolean;
  rescheduledAt?: string | null;
};

export function AppointmentLifecycleBadge({
  status,
  waitingRoomStatus,
  isOverbooking,
  rescheduledAt,
}: Props) {
  const label = resolveAppointmentLifecycleLabel({
    status,
    waitingRoomStatus,
    isOverbooking,
    rescheduledAt,
  });

  return (
    <Badge
      variant={lifecycleLabelToBadgeVariant(label)}
      className={label === "Sobreturno" ? "ring-2 ring-fuchsia-400" : undefined}
    >
      {label}
    </Badge>
  );
}
