import { format } from "date-fns";
import { es } from "date-fns/locale";

import { TelemedicineRoomEmbed } from "@/core/components/telemedicine/telemedicine-room-embed";
import { buildTelemedicineEmbedUrl } from "@/core/telemedicine/provider";

import { loadPublicTelemedicineSession } from "@/lib/actions/telemedicine";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function VideoconsultaPublicPage({ params }: PageProps) {
  const { sessionId } = await params;
  const result = await loadPublicTelemedicineSession(sessionId);

  if (result.error || !result.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-16">
        <div className="w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Videoconsulta no disponible</h1>
          <p className="mt-2 text-sm text-slate-600">{result.error ?? "Link inválido o expirado."}</p>
        </div>
      </div>
    );
  }

  const session = result.data;
  const embedUrl = buildTelemedicineEmbedUrl(session.roomUrl, session.patientName);
  const startLabel = format(new Date(session.appointmentStartAt), "PPp", { locale: es });

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-8">
      <div className="mb-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">DrFlow</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Videoconsulta</h1>
        <p className="mt-2 text-sm text-slate-600">
          {session.clinicName} · {startLabel}
        </p>
      </div>
      <TelemedicineRoomEmbed
        roomUrl={session.roomUrl}
        embedUrl={embedUrl}
        title={`Videoconsulta — ${session.clinicName}`}
      />
      <p className="mt-4 text-center text-xs text-slate-500">
        Permití cámara y micrófono cuando el navegador lo solicite. Si tenés problemas, probá abrir en
        Chrome o Safari.
      </p>
    </div>
  );
}
