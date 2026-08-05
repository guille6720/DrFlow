"use client";

import { Building2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { cn } from "@/shared/utils/cn";

import { useAdminOpsCopilot } from "@/features/ia/components/admin-ops/admin-ops-copilot-context";
import { AdminOpsCopilotSheet } from "@/features/ia/components/admin-ops/admin-ops-copilot-sheet";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

/** Floating admin/ops assistant — bottom-right (Phase G). */
export function AdminOpsCopilotHost() {
  const enabled = useFeatureFlag("admin_ops_assistant");
  const pathname = usePathname();
  const { session, open, setOpen, toggle } = useAdminOpsCopilot();

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Abrir asistente operativo"
        title="Asistente operativo"
        onClick={toggle}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full",
          "bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/30",
          "hover:scale-105 active:scale-95"
        )}
      >
        <Building2 className="h-5 w-5" />
      </button>

      <AdminOpsCopilotSheet open={open} onClose={() => setOpen(false)} context={session} />
    </>
  );
}
