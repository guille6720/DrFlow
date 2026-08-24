"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo, useState, useTransition } from "react";

import {
  evaluatePrivacyDeletionOrBlockingRequest,
  PRIVACY_DELETION_RETENTION_WARNING,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
  type PrivacyRequestStatus,
  privacyRequestStatusLabel,
  type PrivacyRequestType,
  privacyRequestTypeLabel,
  requiresRetentionWarning,
} from "@/core/compliance/privacy-rights";
import { toast } from "@/core/notifications/toast";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PrivacyRightsRequestRow } from "@/lib/actions/privacy-rights";
import {
  createPrivacyRightsRequest,
  updatePrivacyRightsRequest,
} from "@/lib/actions/privacy-rights";

type Props = {
  initialRows: PrivacyRightsRequestRow[];
  loadError?: string | null;
};

export function PrivacyRightsPanel({ initialRows, loadError }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  const [requestType, setRequestType] = useState<PrivacyRequestType>("access");
  const [patientId, setPatientId] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterContact, setRequesterContact] = useState("");
  const [description, setDescription] = useState("");
  const [ackRetention, setAckRetention] = useState(false);

  const evaluation = useMemo(
    () => evaluatePrivacyDeletionOrBlockingRequest(requestType),
    [requestType]
  );
  const needsRetentionAck = requiresRetentionWarning(requestType);

  function handleCreate() {
    startTransition(async () => {
      const result = await createPrivacyRightsRequest({
        requestType,
        patientId: patientId || null,
        requesterName: requesterName || null,
        requesterContact: requesterContact || null,
        description: description || null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pedido de privacidad registrado.");
      if (result.id) {
        setRows((prev) => [
          {
            id: result.id!,
            clinic_id: "",
            patient_id: patientId || null,
            request_type: requestType,
            status: "received",
            requester_name: requesterName || null,
            requester_contact: requesterContact || null,
            description: description || null,
            retention_warning_acknowledged: false,
            resolution_notes: null,
            created_at: new Date().toISOString(),
            resolved_at: null,
          },
          ...prev,
        ]);
      }
      setPatientId("");
      setRequesterName("");
      setRequesterContact("");
      setDescription("");
      setAckRetention(false);
    });
  }

  function handleStatusChange(
    row: PrivacyRightsRequestRow,
    status: PrivacyRequestStatus,
    retentionAck?: boolean
  ) {
    startTransition(async () => {
      const result = await updatePrivacyRightsRequest({
        id: row.id,
        status,
        retentionWarningAcknowledged:
          retentionAck ?? row.retention_warning_acknowledged,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pedido actualizado.");
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                status,
                retention_warning_acknowledged:
                  retentionAck ?? r.retention_warning_acknowledged,
                resolved_at:
                  status === "fulfilled" ||
                  status === "rejected" ||
                  status === "cancelled"
                    ? new Date().toISOString()
                    : r.resolved_at,
              }
            : r
        )
      );
    });
  }

  if (loadError) {
    return (
      <Card title="Derechos de privacidad (ARCO)">
        <p className="text-sm text-red-600">{loadError}</p>
      </Card>
    );
  }

  return (
    <Card
      title="Derechos de privacidad (ARCO / habeas data)"
      description="Cola administrativa para acceso, rectificación, exportación, bloqueo y pedidos de baja. No borra historias clínicas automáticamente."
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
          {PRIVACY_DELETION_RETENTION_WARNING}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Tipo de pedido</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as PrivacyRequestType)}
            >
              {PRIVACY_REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {privacyRequestTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="ID paciente (opcional)"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="UUID del paciente"
          />
          <Input
            label="Solicitante"
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
          />
          <Input
            label="Contacto"
            value={requesterContact}
            onChange={(e) => setRequesterContact(e.target.value)}
          />
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Detalle</span>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        {needsRetentionAck ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">Acciones recomendadas</p>
            <ul className="list-disc pl-5 text-xs text-slate-600">
              {evaluation.recommendedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            <label className="flex items-start gap-2 text-xs text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={ackRetention}
                onChange={(e) => setAckRetention(e.target.checked)}
              />
              Confirmo que este pedido no implica destrucción automática de HC (solo baja lógica /
              medidas administrativas).
            </label>
          </div>
        ) : null}

        <Button
          type="button"
          loading={pending}
          disabled={needsRetentionAck && !ackRetention}
          onClick={handleCreate}
        >
          Registrar pedido
        </Button>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Solicitante</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-slate-500">
                    Sin pedidos registrados.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 text-slate-600">
                      {format(new Date(row.created_at), "PP", { locale: es })}
                    </td>
                    <td className="px-3 py-2">
                      {privacyRequestTypeLabel(row.request_type)}
                    </td>
                    <td className="px-3 py-2">
                      {privacyRequestStatusLabel(row.status)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {row.requester_name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                        value={row.status}
                        disabled={pending}
                        onChange={(e) => {
                          const next = e.target.value as PrivacyRequestStatus;
                          if (
                            next === "fulfilled" &&
                            requiresRetentionWarning(row.request_type) &&
                            !row.retention_warning_acknowledged
                          ) {
                            const ok = window.confirm(
                              `${PRIVACY_DELETION_RETENTION_WARNING}\n\n¿Confirmás y marcás como cumplido?`
                            );
                            if (!ok) return;
                            handleStatusChange(row, next, true);
                            return;
                          }
                          handleStatusChange(row, next);
                        }}
                      >
                        {PRIVACY_REQUEST_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {privacyRequestStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
