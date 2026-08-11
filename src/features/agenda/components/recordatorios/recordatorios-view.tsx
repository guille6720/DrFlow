"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, Mail, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Header } from "@/core/components/layout/header";

import { formatPatientName } from "@/shared/utils/patient-display";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { sendReminder } from "@/lib/actions/clinic-services";
import type { Clinic, ReminderLog, UserRole } from "@/types/database";

interface Props {
  logs: ReminderLog[];
  pendingAppointments: Array<{
    id: string;
    start_at: string;
    patients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  }>;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
  emailConfigured?: boolean;
}

const channelLabels = { email: "Email", whatsapp: "WhatsApp", internal: "Interna" };
const statusVariant = { queued: "warning", sent: "success", failed: "danger", simulated: "info" } as const;

function statusLabel(log: ReminderLog): string {
  if (log.status === "queued") return "En cola";
  if (log.status === "sent") return "Enviado";
  if (log.status === "failed") return "Falló";
  if (log.status === "simulated") {
    return log.channel === "whatsapp" ? "WhatsApp abierto" : "Simulado";
  }
  return log.status;
}

export function RecordatoriosView({
  logs,
  pendingAppointments,
  clinics,
  clinicId,
  role,
  userName,
  emailConfigured = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSend(appointmentId: string, channel: "email" | "whatsapp" | "internal") {
    setLoading(`${appointmentId}-${channel}`);
    const result = await sendReminder(appointmentId, channel);
    setLoading(null);
    if (result.whatsappUrl) {
      window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
    }
    router.refresh();
  }

  return (
    <>
      <Header
        title="Recordatorios"
        subtitle={
          emailConfigured
            ? "WhatsApp: abre chat · Email: envío real vía Resend/SMTP"
            : "WhatsApp: abre chat · Email: configurá RESEND o SMTP en Vercel"
        }
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>
            <strong>WhatsApp</strong> abre la app con el mensaje cargado: tenés que tocar Enviar.
            No hay API de WhatsApp Business todavía (Fase 2C).
          </p>
          <p className="mt-1">
            <strong>Email</strong>{" "}
            {emailConfigured ? (
              <>se envía en segundo plano con Resend o SMTP configurado en el servidor.</>
            ) : (
              <>
                requiere <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code> o SMTP +
                <code className="rounded bg-amber-100 px-1">EMAIL_FROM</code> en Vercel — ver{" "}
                <code className="rounded bg-amber-100 px-1">.env.example</code>.
              </>
            )}
          </p>
        </div>

        <Card title="Recordatorios de turnos">
          {pendingAppointments.length === 0 ? (
            <p className="text-sm text-slate-500">No hay turnos pendientes para recordar.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingAppointments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatPatientName(a.patients)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(a.start_at), "PPp", { locale: es })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={loading === `${a.id}-email`}
                      onClick={() => handleSend(a.id, "email")}
                    >
                      <Mail className="h-4 w-4" /> {emailConfigured ? "Enviar email" : "Email (sin SMTP)"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={loading === `${a.id}-whatsapp`}
                      onClick={() => handleSend(a.id, "whatsapp")}
                    >
                      <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Historial de envíos">
          {logs.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Sin recordatorios registrados"
              description="Acá vas a ver WhatsApp abiertos y emails enviados o fallidos, con destinatario, canal y estado."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2 pr-4">Destinatario</th>
                    <th className="pb-2 pr-4">Canal</th>
                    <th className="pb-2 pr-4">Estado</th>
                    <th className="pb-2">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2 pr-4">{log.recipient}</td>
                      <td className="py-2 pr-4">{channelLabels[log.channel]}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={statusVariant[log.status]}>{statusLabel(log)}</Badge>
                      </td>
                      <td className="py-2">
                        {format(new Date(log.sent_at ?? log.created_at), "PPp", { locale: es })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
