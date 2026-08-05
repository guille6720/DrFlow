"use client";

import { Check, Pencil, Play, Trash2, User, UserX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { canStartConsultation } from "@/lib/utils/appointment";
import type { Appointment } from "@/types/database";

const agendaBtn =
  "border-slate-500/80 bg-slate-700/90 text-slate-50 hover:bg-slate-600 hover:border-slate-400";

type Props = {
  appointment: Appointment;
  canManage: boolean;
  canStartClinical: boolean;
  onEdit?: (appointment: Appointment) => void;
  acting: boolean;
  startHref: string;
  setStatus: (status: string, cancellationReason?: string) => Promise<void>;
  onCancel: () => void;
};

export function AppointmentRowActions({
  appointment,
  canManage,
  canStartClinical,
  onEdit,
  acting,
  startHref,
  setStatus,
  onCancel,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/pacientes/${appointment.patient_id}`}>
        <Button type="button" size="sm" variant="outline" className={agendaBtn}>
          <User className="h-3.5 w-3.5" />
          Ficha
        </Button>
      </Link>

      {canStartClinical && canStartConsultation(appointment.status) && (
        <Link href={startHref}>
          <Button type="button" size="sm">
            <Play className="h-3.5 w-3.5" />
            Empezar consulta
          </Button>
        </Link>
      )}

      {canManage &&
        appointment.status !== "cancelled" &&
        appointment.status !== "attended" &&
        onEdit && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={agendaBtn}
            onClick={() => onEdit(appointment)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        )}

      {canManage && appointment.status === "pending" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={agendaBtn}
          loading={acting}
          onClick={() => setStatus("confirmed")}
        >
          <Check className="h-3.5 w-3.5" />
          Confirmar
        </Button>
      )}

      {canManage && appointment.status !== "cancelled" && appointment.status !== "attended" && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={agendaBtn}
            loading={acting}
            onClick={() => setStatus("no_show")}
          >
            <UserX className="h-3.5 w-3.5" />
            Ausente
          </Button>
          <Button type="button" size="sm" variant="danger" loading={acting} onClick={onCancel}>
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
        </>
      )}
    </div>
  );
}
