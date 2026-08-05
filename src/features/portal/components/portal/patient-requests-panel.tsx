"use client";

import { Bell, RefreshCw } from "lucide-react";

import { usePatientRequestsPanel } from "@/features/pacientes/hooks/use-patient-requests-panel";
import { PatientRequestCard } from "@/features/portal/components/portal/patient-request-card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  slug: string;
  clinicName: string;
  refreshTrigger?: number;
}

export function PatientRequestsPanel({ slug, clinicName, refreshTrigger = 0 }: Props) {
  const panel = usePatientRequestsPanel({ slug, refreshTrigger });

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
            <p className="mt-2 text-xs text-amber-800">
              Esta lista se guarda en este teléfono/navegador. Si cambiás de dispositivo, no vas a
              ver los mismos pedidos salvo que vuelvas a sacar turno desde acá con el mismo DNI.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          label="Tu DNI (para ver y cancelar turnos)"
          value={panel.documentNumber}
          onChange={(e) => panel.setDocumentNumber(e.target.value)}
          placeholder="Ej: 30123456"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={panel.handleRefresh}
          disabled={!panel.documentNumber.trim()}
        >
          <RefreshCw className={`h-4 w-4 ${panel.refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {panel.requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Todavía no tenés solicitudes guardadas. Pedí un turno o escribile al consultorio por
          WhatsApp.
        </p>
      ) : (
        <ul className="space-y-3">
          {panel.requests.map((request) => (
            <PatientRequestCard key={request.localId} request={request} panel={panel} />
          ))}
        </ul>
      )}
    </div>
  );
}
