"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/core/supabase/client";

/** Refreshes dashboard data on appointment / task-relevant changes. */
export function ClinicalOpsRealtime({ clinicId }: { clinicId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`clinical-ops-${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescription_drafts",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medical_orders",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    const poll = setInterval(() => router.refresh(), 30000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [clinicId, router]);

  return null;
}
