"use client";

import { useEffect, useState, useTransition } from "react";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";
import { fetchPatientAppointmentStatuses } from "@/lib/actions/public-booking";
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
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCircle2,
  Clock,
  Globe,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

interface Props {
  slug: string;
  clinicName: string;
  refreshTrigger?: number;
}

type StatusMap = Record<string, string>;

export function PatientRequestsPanel({
  slug,
  clinicName,
  refreshTrigger = 0,
}: Props) {
  const [documentNumber, setDocumentNumber] = useState("");
  const [requests, setRequests] = useState<PatientRequestRecord[]>([]);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    queueMicrotask(() => {
      const dni = getStoredDocument(slug);
      const list = getPatientRequests(slug);
      setDocumentNumber(dni);
      setRequests(list);

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
          map[row.appointmentId] = row.status;
        }
        setStatuses(map);
      });
    });
  }, [slug, refreshTrigger]);

  const handleRefresh = () => {
    setStoredDocument(slug, documentNumber);
    const list = getPatientRequests(slug);
    setRequests(list);
    refreshStatuses(documentNumber, list);
  };

  const refreshStatuses = (dni: string, list: PatientRequestRecord[]) => {
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
        map[row.appointmentId] = row.status;
      }
      setStatuses(map);
    });
  };

  const handleSaveDni = () => {
    handleRefresh();
  };

  const isConfirmed = (request: PatientRequestRecord) => {
    if (request.appointmentId) {
      const status = statuses[request.appointmentId];
      return status === "confirmed" || status === "attended";
    }
    return false;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-semibold text-slate-900">Mis solicitudes</p>
            <p className="mt-1 text-sm text-slate-600">
              Acá ves tus pedidos a {clinicName}. Cuando el consultorio confirme, aparece el tilde
              verde.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          label="Tu DNI (para actualizar estado)"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
          placeholder="Ej: 30123456"
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={handleSaveDni} disabled={!documentNumber.trim()}>
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
            const confirmed = isConfirmed(request);
            const pending = request.appointmentId
              ? statuses[request.appointmentId] === "pending" || !statuses[request.appointmentId]
              : true;

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
                  </div>
                  <div className="shrink-0">
                    {confirmed ? (
                      <div className="flex flex-col items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-8 w-8" />
                        <span className="text-xs font-semibold">Confirmado</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-amber-600">
                        <Clock className="h-7 w-7" />
                        <span className="text-xs font-medium">
                          {pending ? "Pendiente" : "En revisión"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
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
