"use client";

import { setActiveClinic } from "@/lib/auth/session";
import type { Clinic } from "@/types/database";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
    >
      {clinics.map((m) => (
        <option key={m.clinic_id} value={m.clinic_id}>
          {m.clinic?.name ?? m.clinic_id}
        </option>
      ))}
    </select>
  );
}
