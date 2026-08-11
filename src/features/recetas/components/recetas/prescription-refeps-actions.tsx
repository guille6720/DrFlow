"use client";

import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { submitPrescriptionToRefeps } from "@/lib/actions/refeps";
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

export function PrescriptionRefepsActions({
  prescriptionId,
  refepsStatus = "local",
  refepsId,
  refepsError,
  refepsEnabled = false,
  compact = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!refepsEnabled && refepsStatus === "local") return null;

  const status = refepsStatus ?? "local";
  const canSubmit = refepsEnabled && (status === "pending_refeps" || status === "failed");

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const result = await submitPrescriptionToRefeps(prescriptionId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={refepsBadgeVariant(status)}>
          {status === "submitted" && refepsId ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {refepsId}
            </span>
          ) : (
            REFEPS_STATUS_LABELS[status]
          )}
        </Badge>
      </div>

      {(refepsError || error) && status === "failed" ? (
        <p className="flex items-start gap-1 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error ?? refepsError}
        </p>
      ) : null}

      {canSubmit ? (
        <Button size="sm" variant="outline" loading={loading} onClick={handleSubmit}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar a REFEPS
        </Button>
      ) : null}
    </div>
  );
}
