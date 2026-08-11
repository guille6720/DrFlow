"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Header } from "@/core/components/layout/header";
import { SafeExternalLink } from "@/core/components/safe-link";
import { unwrapJoin } from "@/core/supabase/unwrap-join";

import { formatPatientName } from "@/shared/utils/patient-display";

import { TelemedicineJoinButton } from "@/features/agenda/components/agenda/telemedicine-join-button";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { consultationModalityLabel } from "@/lib/constants/consultation-modality";
import type { Clinic, UserRole } from "@/types/database";

interface Session {
  id: string;
  room_url: string;
  status: string;
  provider?: string | null;
  patient_join_url?: string | null;
  appointment_id: string;
  appointments?: {
    start_at: string;
    consultation_modality?: string | null;
    patients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  } | {
    start_at: string;
    consultation_modality?: string | null;
    patients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  }[] | null;
}

interface Props {
  sessions: Session[];
  appointments: Array<{
    id: string;
    start_at: string;
    consultation_modality?: string | null;
    patients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  }>;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
}

export function TelemedicinaView({ sessions, appointments, clinics, clinicId, role, userName }: Props) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setRefreshing(false);
  }

  const virtualAppointments = appointments.filter((a) => a.consultation_modality === "virtual");

  return (
    <>
      <Header
        title="Telemedicina"
        subtitle="Videoconsultas integradas — Jitsi embed (Daily.co opcional con DAILY_API_KEY)"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
          Creá o uníte a salas desde turnos virtuales. Enviá el link al paciente por email o WhatsApp.
          El paciente ingresa desde <code className="rounded bg-white/70 px-1">/videoconsulta/…</code> sin
          login.
        </div>

        <Card title="Turnos virtuales próximos">
          {virtualAppointments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay turnos virtuales próximos. Marcá un turno como Virtual al reservarlo.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {virtualAppointments.map((a) => (
                <li key={a.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{formatPatientName(a.patients)}</p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(a.start_at), "PPp", { locale: es })}
                    </p>
                    <Badge variant="info" className="mt-1">
                      {consultationModalityLabel(a.consultation_modality)}
                    </Badge>
                  </div>
                  <TelemedicineJoinButton appointmentId={a.id} compact />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Sesiones recientes">
          {sessions.length === 0 ? (
            <EmptyState
              icon={Video}
              title="Sin videoconsultas"
              description="Creá una sala desde un turno virtual en la agenda o arriba."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => {
                const appt = unwrapJoin(s.appointments ?? null);
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">{formatPatientName(appt?.patients)}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="info">{s.status}</Badge>
                        {s.provider ? <Badge variant="default">{s.provider}</Badge> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/telemedicina/sala/${s.id}`}>
                        <Button size="sm" type="button">
                          <Video className="h-4 w-4" /> Unirse
                        </Button>
                      </Link>
                      {s.patient_join_url ? (
                        <SafeExternalLink href={s.patient_join_url}>
                          <Button size="sm" variant="outline" type="button">
                            <ExternalLink className="h-4 w-4" /> Link paciente
                          </Button>
                        </SafeExternalLink>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4">
            <Button type="button" variant="ghost" size="sm" loading={refreshing} onClick={handleRefresh}>
              Actualizar
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
