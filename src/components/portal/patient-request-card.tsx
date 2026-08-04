import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";
import {
  requestChannelLabel,
  requestTypeLabel,
  type PatientRequestRecord,
} from "@/lib/utils/patient-requests-storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { PatientRequestsPanelState } from "@/lib/hooks/use-patient-requests-panel";
import { CheckCircle2, Clock, Globe, MessageCircle, XCircle } from "lucide-react";

interface Props {
  request: PatientRequestRecord;
  panel: PatientRequestsPanelState;
}

export function PatientRequestCard({ request, panel }: Props) {
  const apptStatus = request.appointmentId ? panel.statuses[request.appointmentId] : undefined;
  const confirmed = panel.isConfirmed(request);
  const cancelled = panel.isCancelled(request);
  const showCancel = panel.canCancel(request);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">{requestTypeLabel(request.type)}</p>
            <Badge variant={request.channel === "web" ? "info" : "default"}>
              {request.channel === "web" ? (
                <Globe className="mr-1 h-3 w-3" />
              ) : (
                <MessageCircle className="mr-1 h-3 w-3 text-[#25D366]" />
              )}
              {requestChannelLabel(request.channel)}
            </Badge>
          </div>
          {request.startAt && (
            <p className="mt-1 text-sm text-slate-600">
              {formatClinicDateTime(request.startAt, "EEEE d 'de' MMMM · HH:mm 'hs'")}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            Solicitado {formatClinicDateTime(request.createdAt, "d/M/yyyy HH:mm")}
          </p>
          {cancelled && apptStatus && (
            <p className="mt-2 text-xs text-red-700">
              Cancelado{" "}
              {apptStatus.cancelledByType === "patient" ? "por vos" : "por el consultorio"}
              {apptStatus.cancellationReason ? ` · ${apptStatus.cancellationReason}` : ""}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {cancelled ? (
            <div className="flex flex-col items-center gap-1 text-red-600">
              <XCircle className="h-8 w-8" />
              <span className="text-xs font-semibold">Cancelado</span>
            </div>
          ) : confirmed ? (
            <div className="flex flex-col items-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
              <span className="text-xs font-semibold">Confirmado</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-amber-600">
              <Clock className="h-7 w-7" />
              <span className="text-xs font-medium">Pendiente</span>
            </div>
          )}
        </div>
      </div>

      {showCancel && panel.cancelTarget !== request.appointmentId && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 w-full border-red-200 text-red-700 hover:bg-red-50"
          onClick={() => {
            panel.setCancelTarget(request.appointmentId!);
            panel.setCancelReason("");
            panel.setCancelError(null);
          }}
        >
          Cancelar turno
        </Button>
      )}

      {panel.cancelTarget === request.appointmentId && (
        <div className="mt-3 space-y-2 rounded-lg border border-red-100 bg-red-50/50 p-3">
          <Textarea
            label="Motivo de cancelación"
            value={panel.cancelReason}
            onChange={(e) => {
              panel.setCancelReason(e.target.value);
              panel.setCancelError(null);
            }}
            placeholder="Ej: No puedo concurrir ese día"
            rows={2}
          />
          {panel.cancelError && <p className="text-xs text-red-700">{panel.cancelError}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="danger"
              loading={panel.cancelling}
              onClick={() => panel.handleCancelSubmit(request.appointmentId!)}
            >
              Confirmar cancelación
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={panel.cancelling}
              onClick={() => panel.setCancelTarget(null)}
            >
              Volver
            </Button>
          </div>
        </div>
      )}

      {!request.appointmentId && request.channel === "whatsapp" && (
        <p className="mt-2 text-xs text-slate-500">
          Enviado por WhatsApp. El consultorio te responderá por ese medio.
        </p>
      )}
    </li>
  );
}
