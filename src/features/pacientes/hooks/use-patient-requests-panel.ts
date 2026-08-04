"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  cancelPatientAppointment,
  fetchPatientAppointmentStatuses,
} from "@/lib/actions/public-booking";
import {
  getPatientRequests,
  getStoredDocument,
  setStoredDocument,
  type PatientRequestRecord,
} from "@/features/pacientes/utils/patient-requests-storage";

interface AppointmentStatusRow {
  status: string;
  cancellationReason: string | null;
  cancelledAt: string | null;
  cancelledByType: string | null;
}

type StatusMap = Record<string, AppointmentStatusRow>;

type Options = {
  slug: string;
  refreshTrigger?: number;
};

export function usePatientRequestsPanel({ slug, refreshTrigger = 0 }: Options) {
  const [documentNumber, setDocumentNumber] = useState("");
  const [requests, setRequests] = useState<PatientRequestRecord[]>([]);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [refreshing, startRefresh] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, startCancel] = useTransition();

  const loadStatuses = useCallback((dni: string, list: PatientRequestRecord[]) => {
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
  }, [slug]);

  useEffect(() => {
    queueMicrotask(() => {
      const dni = getStoredDocument(slug);
      const list = getPatientRequests(slug);
      setDocumentNumber(dni);
      setRequests(list);
      loadStatuses(dni, list);
    });
  }, [slug, refreshTrigger, loadStatuses]);

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

  return {
    documentNumber,
    setDocumentNumber,
    requests,
    statuses,
    refreshing,
    cancelTarget,
    setCancelTarget,
    cancelReason,
    setCancelReason,
    cancelError,
    setCancelError,
    cancelling,
    handleRefresh,
    isConfirmed,
    isCancelled,
    canCancel,
    handleCancelSubmit,
  };
}

export type PatientRequestsPanelState = ReturnType<typeof usePatientRequestsPanel>;
