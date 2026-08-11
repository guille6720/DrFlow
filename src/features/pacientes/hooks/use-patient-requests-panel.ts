"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  getStoredDocument,
  getWhatsappPatientRequests,
  type PatientRequestRecord,
  setStoredDocument,
} from "@/features/pacientes/utils/patient-requests-storage";
import {
  mapPortalAppointmentToRequestItem,
  mergePatientRequestItems,
  type PatientRequestItem,
} from "@/features/portal/utils/patient-portal-appointments";

import {
  cancelPatientAppointment,
  fetchPatientPortalAppointments,
} from "@/lib/actions/public-booking";

type Options = {
  slug: string;
  refreshTrigger?: number;
};

function mapWhatsappRequest(record: PatientRequestRecord): PatientRequestItem {
  return {
    id: record.localId,
    appointmentId: record.appointmentId,
    type: record.type,
    channel: record.channel,
    patientName: record.patientName,
    startAt: record.startAt,
    createdAt: record.createdAt,
  };
}

export function usePatientRequestsPanel({ slug, refreshTrigger = 0 }: Options) {
  const [documentNumber, setDocumentNumber] = useState("");
  const [items, setItems] = useState<PatientRequestItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, startCancel] = useTransition();

  const loadAppointments = useCallback((dni: string) => {
    const trimmed = dni.trim();
    if (!trimmed) {
      setItems([]);
      setLoadError(null);
      return;
    }

    startRefresh(async () => {
      setLoadError(null);
      const result = await fetchPatientPortalAppointments(slug, trimmed);
      if (result.error) {
        setLoadError(result.error);
      }

      const serverItems = (result.appointments ?? []).map(mapPortalAppointmentToRequestItem);
      const localWhatsapp = getWhatsappPatientRequests(slug)
        .filter((record) => record.documentNumber === trimmed)
        .map(mapWhatsappRequest);

      setItems(mergePatientRequestItems(serverItems, localWhatsapp));
    });
  }, [slug]);

  useEffect(() => {
    queueMicrotask(() => {
      const dni = getStoredDocument(slug);
      setDocumentNumber(dni);
      loadAppointments(dni);
    });
  }, [slug, refreshTrigger, loadAppointments]);

  const handleRefresh = () => {
    setStoredDocument(slug, documentNumber);
    loadAppointments(documentNumber);
  };

  const isConfirmed = (request: PatientRequestItem) => request.status === "confirmed";

  const isCancelled = (request: PatientRequestItem) => request.status === "cancelled";

  const canCancel = (request: PatientRequestItem) => {
    if (!request.appointmentId) return false;
    return request.status === "pending" || request.status === "confirmed";
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
    items,
    loadError,
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
