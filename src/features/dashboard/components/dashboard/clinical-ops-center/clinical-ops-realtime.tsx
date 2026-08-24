"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { createClient } from "@/core/supabase/client";

const MIN_REFRESH_MS = 5000;

/** Refreshes dashboard data on appointment / task-relevant changes. */
export function ClinicalOpsRealtime({ clinicId }: { clinicId: string }) {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (err) {
      console.error("[clinical-ops-realtime] supabase client failed", err);
      return;
    }

    const refresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_REFRESH_MS) return;
      lastRefreshRef.current = now;
      try {
        router.refresh();
      } catch {
        /* ignore refresh failures */
      }
    };

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
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescription_drafts",
          filter: `clinic_id=eq.${clinicId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medical_orders",
          filter: `clinic_id=eq.${clinicId}`,
        },
        refresh
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clinicId, router]);

  return null;
}
