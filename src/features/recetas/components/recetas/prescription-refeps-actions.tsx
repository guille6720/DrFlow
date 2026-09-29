"use client";

import { AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { RefepsStatus } from "@/types/prescription";
import { REFEPS_STATUS_LABELS } from "@/types/prescription";

type Props = {
  prescriptionId: string;
  refepsStatus?: RefepsStatus | null;
  refepsId?: string | null;
  refepsError?: string | null;
  refepsEnabled?: boolean;
  compact?: boolean;
};

function refepsBadgeVariant(
  status: RefepsStatus | null | undefined
): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "submitted":
      return "success";
    case "failed":
      return "danger";
    case "pending_refeps":
      return "warning";
    default:
      return "default";
  }
}

/**
 * Legacy REFEPS adapter status (read-only, historical records). New national submissions go through
 * `NationalPrescriptionPanel` (REFEPS validation → ReNaPDiS repository → CUIR).
 */
export function PrescriptionRefepsActions({
  refepsStatus = "local",
  refepsId,
  refepsError,
  compact = false,
}: Props) {
  const status = refepsStatus ?? "local";
  if (status === "local") return null;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={refepsBadgeVariant(status)}>
          {status === "submitted" && refepsId ? `${REFEPS_STATUS_LABELS[status]} · ${refepsId}` : REFEPS_STATUS_LABELS[status]}
        </Badge>
      </div>

      {refepsError && status === "failed" ? (
        <p className="flex items-start gap-1 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {refepsError}
        </p>
      ) : null}
    </div>
  );
}
