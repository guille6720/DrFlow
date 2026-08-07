"use client";

import { HeartPulse, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { LiveStatusMessage } from "@/core/components/accessibility/live-status-message";

import { usePamiMessages } from "@/features/pami/i18n";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { configurePamiCabecera } from "@/lib/actions/pami-setup";

interface PamiSetupPanelProps {
  practiceProfile: string | null;
  defaultInsurance: string | null;
}

export function PamiSetupPanel({ practiceProfile, defaultInsurance }: PamiSetupPanelProps) {
  const t = usePamiMessages().setup.panel;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const feedbackId = useId();

  /** Synchronous guard — blocks double-click before React re-renders loading. */
  const setupInFlightRef = useRef(false);

  const isConfigured = practiceProfile === "cabecera_pami";

  async function handleSetup() {
    if (setupInFlightRef.current || loading) return;

    setupInFlightRef.current = true;
    setLoading(true);
    setMsg(null);
    setErr(null);

    try {
      const result = await configurePamiCabecera();
      if (result.error) {
        setErr(result.error);
        return;
      }

      setMsg(result.message ?? t.successFallback);
      router.refresh();
    } catch {
      setErr(t.errorFallback);
    } finally {
      setupInFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <Card title={t.title}>
      <p className="mb-3 text-sm text-slate-600">{t.description}</p>

      {isConfigured ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          role="status"
        >
          {t.activeStatus(defaultInsurance ?? t.defaultInsurance)}
          <span className="mt-1 block text-xs text-emerald-700">{t.activeHint}</span>
        </div>
      ) : (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          role="status"
        >
          {t.inactiveStatus}
        </div>
      )}

      <div id={feedbackId} className="mt-3 space-y-3">
        {msg ? (
          <LiveStatusMessage
            tone="success"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800"
          >
            {msg}
          </LiveStatusMessage>
        ) : null}
        {err ? (
          <LiveStatusMessage tone="error" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
            {err}
          </LiveStatusMessage>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleSetup}
          loading={loading}
          disabled={loading}
          aria-busy={loading}
          aria-describedby={msg || err ? feedbackId : undefined}
          aria-label={
            loading ? t.configuringAria : isConfigured ? t.updateAria : t.activateAria
          }
          variant="secondary"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <HeartPulse className="h-4 w-4" aria-hidden />
          )}
          {isConfigured ? t.updateButton : t.activateButton}
        </Button>
      </div>
    </Card>
  );
}
