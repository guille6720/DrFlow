"use client";

import { useCallback, useState } from "react";
import { createAppointment } from "@/lib/actions/appointments";
import {
  CONSULTATION_FOLLOW_UP_DEFAULT_DURATION,
  CONSULTATION_FOLLOW_UP_DEFAULT_NOTES,
  buildFollowUpAppointmentFormData,
  defaultFollowUpStartAt,
  validateFollowUpProfessional,
} from "@/lib/utils/consultation-follow-up";

type Options = {
  patientId: string;
  professionalId?: string;
  onScheduled: () => void;
};

export function useConsultationFollowUp({ patientId, professionalId, onScheduled }: Options) {
  const [startAt, setStartAt] = useState(defaultFollowUpStartAt);
  const [notes, setNotes] = useState(CONSULTATION_FOLLOW_UP_DEFAULT_NOTES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const validationError = validateFollowUpProfessional(professionalId);
      if (validationError) {
        setError(validationError);
        return;
      }

      setLoading(true);
      setError(null);
      const formData = buildFollowUpAppointmentFormData({
        patientId,
        professionalId: professionalId!,
        startAt,
        duration: CONSULTATION_FOLLOW_UP_DEFAULT_DURATION,
        notes,
      });
      const result = await createAppointment(formData);
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      onScheduled();
    },
    [notes, onScheduled, patientId, professionalId, startAt]
  );

  return {
    startAt,
    setStartAt,
    notes,
    setNotes,
    loading,
    error,
    duration: CONSULTATION_FOLLOW_UP_DEFAULT_DURATION,
    handleSubmit,
  };
}
