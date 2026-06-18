"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { finalizeConsultation } from "@/lib/actions/clinic";
import { clearConsultationTimer } from "@/components/historias/consultation-timer";
import { CheckCircle2 } from "lucide-react";

interface Props {
  appointmentId: string;
}

export function FinalizeConsultationButton({ appointmentId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleFinalize() {
    setLoading(true);
    const result = await finalizeConsultation(appointmentId);
    setLoading(false);
    if (!result.error) {
      clearConsultationTimer(appointmentId);
      router.push("/agenda?view=day");
      router.refresh();
    }
  }

  return (
    <Button type="button" loading={loading} onClick={handleFinalize}>
      <CheckCircle2 className="h-4 w-4" />
      Finalizar consulta
    </Button>
  );
}
