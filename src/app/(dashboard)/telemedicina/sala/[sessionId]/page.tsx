import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { TelemedicineRoomEmbed } from "@/core/components/telemedicine/telemedicine-room-embed";
import { canAccessRoute } from "@/core/permissions/roles";
import { unwrapJoin } from "@/core/supabase/unwrap-join";
import { buildPatientJoinUrl, buildTelemedicineEmbedUrl } from "@/core/telemedicine/provider";

import { TelemedicineSessionControls } from "@/features/telemedicina/components/telemedicina/telemedicine-session-controls";

import { ButtonLink } from "@/components/ui/button";
import { loadStaffTelemedicineSession } from "@/lib/actions/telemedicine";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function TelemedicinaSalaPage({ params }: PageProps) {
  const { sessionId } = await params;
  const { profile, role, isSuperadmin } = await getDashboardPageContext();

  if (!canAccessRoute(role, "/telemedicina", isSuperadmin)) {
    redirect("/dashboard");
  }

  const result = await loadStaffTelemedicineSession(sessionId);
  if (result.error || !result.data) {
    redirect("/telemedicina");
  }

  const session = result.data;
  const appointment = unwrapJoin(session.appointments ?? null);
  const patient = unwrapJoin(appointment?.patients ?? null);
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Paciente";
  const professionalName = profile?.full_name ?? "Profesional";
  const embedUrl = buildTelemedicineEmbedUrl(session.room_url, professionalName);
  const patientJoinUrl = session.patient_join_url ?? buildPatientJoinUrl(session.id);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Videoconsulta</h1>
          <p className="text-sm text-slate-600">
            {patientName}
            {appointment?.start_at
              ? ` · ${format(new Date(appointment.start_at), "PPp", { locale: es })}`
              : null}
          </p>
        </div>
        <ButtonLink href="/telemedicina" variant="outline" size="sm">
          Volver
        </ButtonLink>
      </div>

      <TelemedicineRoomEmbed roomUrl={session.room_url} embedUrl={embedUrl} />

      <TelemedicineSessionControls sessionId={session.id} status={session.status} />

      {patientJoinUrl ? (
        <p className="text-xs text-slate-500">
          Link paciente:{" "}
          <Link href={patientJoinUrl} className="text-teal-700 hover:underline">
            {patientJoinUrl}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
