"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setActiveClinic } from "@/core/auth/session";

import type { Clinic } from "@/types/database";

interface ClinicSelectorProps {
  clinics: { clinic_id: string; clinic?: Clinic }[];
  activeClinicId: string;
}

export function ClinicSelector({ clinics, activeClinicId }: ClinicSelectorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={activeClinicId}
      disabled={pending}
      onChange={(e) => {
        startTransition(async () => {
          await setActiveClinic(e.target.value);
          router.refresh();
        });
      }}
      className="drflow-ui-input drflow-ui-select rounded-lg border px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
    >
      {clinics.map((m) => (
        <option key={m.clinic_id} value={m.clinic_id}>
          {m.clinic?.name ?? m.clinic_id}
        </option>
      ))}
    </select>
  );
}
