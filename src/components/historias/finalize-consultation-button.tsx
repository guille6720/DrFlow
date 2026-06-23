"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { finalizeConsultation } from "@/lib/actions/clinic";
import { clearConsultationTimer } from "@/components/historias/consultation-timer";
import { CONSULTATION_MODALITY_OPTIONS } from "@/lib/constants/consultation-modality";
import type { ConsultationModality } from "@/lib/constants/consultation-modality";
import { CheckCircle2 } from "lucide-react";

interface Props {
  appointmentId: string;
}

export function FinalizeConsultationButton({ appointmentId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modality, setModality] = useState<ConsultationModality>("presencial");

  async function handleFinalize() {
    setLoading(true);
    const result = await finalizeConsultation(appointmentId, modality);
    setLoading(false);
    if (!result.error) {
      clearConsultationTimer(appointmentId);
      router.push("/agenda?view=day");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        label="Modalidad"
        value={modality}
        onChange={(e) => setModality(e.target.value as ConsultationModality)}
        options={CONSULTATION_MODALITY_OPTIONS.map((item) => ({
          value: item.value,
          label: item.label,
        }))}
        className="min-w-[140px]"
      />
      <Button type="button" loading={loading} onClick={handleFinalize}>
        <CheckCircle2 className="h-4 w-4" />
        Finalizar consulta
      </Button>
    </div>
  );
}
