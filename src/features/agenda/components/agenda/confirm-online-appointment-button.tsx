"use client";

import { Check } from "lucide-react";

import { toast } from "@/core/notifications/toast";
import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { useAppointmentRow } from "@/features/agenda/hooks/use-appointment-row";

import { Button } from "@/components/ui/button";

export function ConfirmOnlineAppointmentButton({
  appointment,
  onConfirmed,
}: {
  appointment: AppointmentAgendaRow;
  onConfirmed?: () => void;
}) {
  const { acting, setStatus } = useAppointmentRow(appointment);

  async function confirm() {
    const result = await setStatus("confirmed");
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Turno online confirmado");
    onConfirmed?.();
  }

  return (
    <Button type="button" size="sm" loading={acting} pendingLabel="Confirmando…" onClick={confirm}>
      <Check aria-hidden="true" className="h-4 w-4" />
      Confirmar turno online
    </Button>
  );
}
