"use client";

import { Loader2, Mail, Send, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toast } from "@/core/notifications/toast";

import { Button } from "@/components/ui/button";
import {
  getOrCreateTelemedicineSession,
  sendTelemedicineLinkToPatient,
  updateTelemedicineSessionStatus,
} from "@/lib/actions/telemedicine";

type Props = {
  appointmentId: string;
  compact?: boolean;
};

export function TelemedicineJoinButton({ appointmentId, compact = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "join" | "send">("idle");

  function handleJoin() {
    setMode("join");
    startTransition(async () => {
      const result = await getOrCreateTelemedicineSession(appointmentId);
      if (result.error || !result.data) {
        toast.error(result.error ?? "No se pudo crear la sala");
        setMode("idle");
        return;
      }
      if (result.data.status === "scheduled") {
        await updateTelemedicineSessionStatus(result.data.id, "active");
      }
      router.push(`/telemedicina/sala/${result.data.id}`);
    });
  }

  function handleSendLink() {
    setMode("send");
    startTransition(async () => {
      const result = await sendTelemedicineLinkToPatient(appointmentId);
      if (result.error) {
        toast.error(result.error);
        setMode("idle");
        return;
      }
      if (result.channel === "whatsapp") {
        if (result.sentViaApi) {
          toast.success("Link de videoconsulta enviado por WhatsApp");
        } else if (result.whatsappUrl) {
          window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
          toast.success("Link listo para enviar por WhatsApp");
        } else {
          toast.success("Link de videoconsulta enviado por WhatsApp");
        }
      } else {
        toast.success("Link de videoconsulta enviado por email");
      }
      setMode("idle");
      router.refresh();
    });
  }

  const loading = pending;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={loading} onClick={handleJoin}>
          {loading && mode === "join" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Video className="h-3.5 w-3.5" />
          )}
          Unirse
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={handleSendLink}>
          {loading && mode === "send" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Enviar link
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={loading} onClick={handleJoin}>
        {loading && mode === "join" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Video className="h-4 w-4" />
        )}
        Unirse a videoconsulta
      </Button>
      <Button type="button" variant="outline" disabled={loading} onClick={handleSendLink}>
        {loading && mode === "send" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        Enviar link al paciente
      </Button>
      <Button type="button" variant="ghost" onClick={() => router.push("/telemedicina")}>
        Ver todas
      </Button>
    </div>
  );
}
