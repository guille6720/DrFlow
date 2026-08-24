"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { toast } from "@/core/notifications/toast";

import { Button } from "@/components/ui/button";
import { updateTelemedicineSessionStatus } from "@/lib/actions/telemedicine";
import type { TelemedicineStatus } from "@/types/database";

type Props = {
  sessionId: string;
  status: TelemedicineStatus;
};

export function TelemedicineSessionControls({ sessionId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleComplete() {
    startTransition(async () => {
      const result = await updateTelemedicineSessionStatus(sessionId, "completed");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Videoconsulta finalizada");
      router.push("/telemedicina");
    });
  }

  if (status === "completed" || status === "cancelled") {
    return null;
  }

  return (
    <div className="flex justify-end">
      <Button type="button" variant="outline" loading={pending} onClick={handleComplete}>
        Finalizar videoconsulta
      </Button>
    </div>
  );
}
