"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/core/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createTelemedicineSession } from "@/lib/actions/clinic-services";
import type { Clinic, UserRole } from "@/types/database";
import { Video, ExternalLink } from "lucide-react";
import { SafeExternalLink } from "@/core/components/safe-link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Session {
  id: string;
  room_url: string;
  status: string;
  appointment_id: string;
  appointments?: {
    start_at: string;
    patients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  } | null;
}

function formatPatientName(
  patients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
) {
  if (!patients) return "Paciente";
  const p = Array.isArray(patients) ? patients[0] : patients;
  return p ? `${p.last_name}, ${p.first_name}` : "Paciente";
}

interface Props {
  sessions: Session[];
  appointments: Array<{
    id: string;
    start_at: string;
    patients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  }>;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
}

export function TelemedicinaView({ sessions, appointments, clinics, clinicId, role, userName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCreate(appointmentId: string) {
    setLoading(appointmentId);
    await createTelemedicineSession(appointmentId);
    setLoading(null);
    router.refresh();
  }

  return (
    <>
      <Header
        title="Telemedicina"
        subtitle="Lab: salas Jitsi de prueba — no es telemedicina clínica homologada"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Generá un link de sala virtual de prueba. La integración definitiva queda pendiente.
        </div>
        <Card title="Crear sala virtual">
          {appointments.length === 0 ? (
            <p className="text-sm text-slate-500">No hay turnos próximos para videoconsulta.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {appointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">
                      {formatPatientName(a.patients)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(a.start_at), "PPp", { locale: es })}
                    </p>
                  </div>
                  <Button size="sm" loading={loading === a.id} onClick={() => handleCreate(a.id)}>
                    <Video className="h-4 w-4" /> Crear sala
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Sesiones activas">
          {sessions.length === 0 ? (
            <EmptyState
              icon={Video}
              title="Sin videoconsultas"
              description="Creá una sala virtual desde un turno programado."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">
                      {formatPatientName(s.appointments?.patients)}
                    </p>
                    <Badge variant="info">{s.status}</Badge>
                  </div>
                  <SafeExternalLink href={s.room_url}>
                    <Button size="sm" variant="outline" type="button">
                      <ExternalLink className="h-4 w-4" /> Abrir sala
                    </Button>
                  </SafeExternalLink>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
