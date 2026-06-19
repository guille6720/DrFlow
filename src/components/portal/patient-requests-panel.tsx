"use client";

import { useEffect, useState, useTransition } from "react";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";
import {
  cancelPatientAppointment,
  fetchPatientAppointmentStatuses,
} from "@/lib/actions/public-booking";
import {
  getPatientRequests,
  getStoredDocument,
  requestChannelLabel,
  requestTypeLabel,
  setStoredDocument,
  type PatientRequestRecord,
} from "@/lib/utils/patient-requests-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCircle2,
  Clock,
  Globe,
  MessageCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface Props {
  slug: string;
  clinicName: string;
  refreshTrigger?: number;
}

interface AppointmentStatusRow {
  status: string;
  cancellationReason: string | null;
  cancelledAt: string | null;
  cancelledByType: string | null;
}

type StatusMap = Record<string, AppointmentStatusRow>;

export function PatientRequestsPanel({
  slug,
  clinicName,
  refreshTrigger = 0,
}: Props) {
  const [documentNumber, setDocumentNumber] = useState("");
  const [requests, setRequests] = useState<PatientRequestRecord[]>([]);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [refreshing, startRefresh] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, startCancel] = useTransition();

  const loadStatuses = (dni: string, list: PatientRequestRecord[]) => {
    const ids = list
      .map((r) => r.appointmentId)
      .filter((id): id is string => Boolean(id));

    if (!dni.trim() || ids.length === 0) {
      setStatuses({});
      return;
    }

    startRefresh(async () => {
      const result = await fetchPatientAppointmentStatuses(slug, dni, ids);
      const map: StatusMap = {};
      for (const row of result.statuses ?? []) {
        map[row.appointmentId] = {
          status: row.status,
          cancellationReason: row.cancellationReason,
          cancelledAt: row.cancelledAt,
          cancelledByType: row.cancelledByType,
        };
      }
      setStatuses(map);
    });
  };

  useEffect(() => {
    queueMicrotask(() => {
      const dni = getStoredDocument(slug);
      const list = getPatientRequests(slug);
      setDocumentNumber(dni);
      setRequests(list);
      loadStatuses(dni, list);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, refreshTrigger]);

  const handleRefresh = () => {
    setStoredDocument(slug, documentNumber);
    const list = getPatientRequests(slug);
    setRequests(list);
    loadStatuses(documentNumber, list);
  };

  const isConfirmed = (request: PatientRequestRecord) => {
    if (!request.appointmentId) return false;
    return statuses[request.appointmentId]?.status === "confirmed";
  };

  const isCancelled = (request: PatientRequestRecord) => {
    if (!request.appointmentId) return false;
    return statuses[request.appointmentId]?.status === "cancelled";
  };

  const canCancel = (request: PatientRequestRecord) => {
    if (!request.appointmentId) return false;
    const status = statuses[request.appointmentId]?.status;
    return status === "pending" || status === "confirmed";
  };

  function handleCancelSubmit(appointmentId: string) {
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setCancelError("Indicá el motivo (mín. 3 caracteres)");
      return;
    }
    setCancelError(null);
    startCancel(async () => {
      const result = await cancelPatientAppointment(slug, documentNumber, appointmentId, reason);
      if (result.error) {
        setCancelError(result.error);
        return;
      }
      setCancelTarget(null);
      setCancelReason("");
      handleRefresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-slate-900">Mis turnos y solicitudes</p>
            <p className="mt-1 text-sm text-slate-600">
              Acá ves el estado de tus pedidos a {clinicName}. Podés cancelar turnos confirmados o
              pendientes.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          label="Tu DNI (para ver y cancelar turnos)"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
          placeholder="Ej: 30123456"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={!documentNumber.trim()}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Todavía no tenés solicitudes guardadas. Pedí un turno o escribile al consultorio por
          WhatsApp.
        </p>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => {
            const apptStatus = request.appointmentId
              ? statuses[request.appointmentId]
              : undefined;
            const confirmed = isConfirmed(request);
            const cancelled = isCancelled(request);
            const showCancel = canCancel(request);

            return (
              <li
                key={request.localId}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">
                        {requestTypeLabel(request.type)}
                      </p>
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
                        {apptStatus.cancelledByType === "patient"
                          ? "por vos"
                          : "por el consultorio"}
                        {apptStatus.cancellationReason
                          ? ` · ${apptStatus.cancellationReason}`
                          : ""}
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

                {showCancel && cancelTarget !== request.appointmentId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setCancelTarget(request.appointmentId!);
                      setCancelReason("");
                      setCancelError(null);
                    }}
                  >
                    Cancelar turno
                  </Button>
                )}

                {cancelTarget === request.appointmentId && (
                  <div className="mt-3 space-y-2 rounded-lg border border-red-100 bg-red-50/50 p-3">
                    <Textarea
                      label="Motivo de cancelación"
                      value={cancelReason}
                      onChange={(e) => {
                        setCancelReason(e.target.value);
                        setCancelError(null);
                      }}
                      placeholder="Ej: No puedo concurrir ese día"
                      rows={2}
                    />
                    {cancelError && (
                      <p className="text-xs text-red-700">{cancelError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        loading={cancelling}
                        onClick={() => handleCancelSubmit(request.appointmentId!)}
                      >
                        Confirmar cancelación
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={cancelling}
                        onClick={() => setCancelTarget(null)}
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
          })}
        </ul>
      )}
    </div>
  );
}
