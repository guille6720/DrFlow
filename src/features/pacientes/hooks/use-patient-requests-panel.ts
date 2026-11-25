"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  getWhatsappPatientRequests,
  type PatientRequestRecord,
} from "@/features/pacientes/utils/patient-requests-storage";
import { logoutPatientPortalSession } from "@/features/portal/actions/patient-portal-logout";
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
  demoBooking?: boolean;
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

export function usePatientRequestsPanel({ slug, refreshTrigger = 0, demoBooking = false }: Options) {
  const [authenticated, setAuthenticated] = useState(false);
  const [items, setItems] = useState<PatientRequestItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [loggingOut, startLogout] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, startCancel] = useTransition();
  const latestRequest = useRef(0);

  const loadAppointments = useCallback(() => {
    const request = ++latestRequest.current;
    startRefresh(async () => {
      setLoadError(null);
      const result = await fetchPatientPortalAppointments(slug);
      if (request !== latestRequest.current) return;
      setAuthenticated(Boolean(result.authenticated));
      if (result.error) {
        setLoadError(result.error);
      }

      const serverItems = (result.appointments ?? []).map(mapPortalAppointmentToRequestItem);
      const localWhatsapp = result.authenticated && !demoBooking
        ? getWhatsappPatientRequests(slug).map(mapWhatsappRequest)
        : [];

      setItems(mergePatientRequestItems(serverItems, localWhatsapp));
    });
  }, [slug, demoBooking]);

  useEffect(() => {
    queueMicrotask(() => {
      loadAppointments();
    });
  }, [slug, refreshTrigger, loadAppointments]);

  const pendingDemoBooking = demoBooking && items.some((item) => item.trackingOnly && item.status === "pending");
  useEffect(() => {
    if (!pendingDemoBooking) return;

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") loadAppointments();
    }

    document.addEventListener("visibilitychange", refreshWhenVisible);
    const timer = window.setInterval(refreshWhenVisible, 15_000);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(timer);
    };
  }, [pendingDemoBooking, loadAppointments]);

  const handleRefresh = () => {
    loadAppointments();
  };

  const handleLogout = () => {
    startLogout(async () => {
      await logoutPatientPortalSession();
      latestRequest.current++;
      setAuthenticated(false);
      setItems([]);
      setLoadError(null);
    });
  };

  const isConfirmed = (request: PatientRequestItem) => request.status === "confirmed";

  const isCancelled = (request: PatientRequestItem) => request.status === "cancelled";

  const canCancel = (request: PatientRequestItem) => {
    if (!request.appointmentId || request.trackingOnly) return false;
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
      const result = await cancelPatientAppointment(slug, appointmentId, reason);
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
    authenticated,
    items,
    loadError,
    refreshing,
    loggingOut,
    cancelTarget,
    setCancelTarget,
    cancelReason,
    setCancelReason,
    cancelError,
    setCancelError,
    cancelling,
    handleRefresh,
    handleLogout,
    isConfirmed,
    isCancelled,
    canCancel,
    handleCancelSubmit,
  };
}

export type PatientRequestsPanelState = ReturnType<typeof usePatientRequestsPanel>;
