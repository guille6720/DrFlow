"use client";

import { AlertTriangle, Check, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  PHYSICIAN_ASSIST_DISCLAIMER,
  PHYSICIAN_ASSIST_KIND_LABELS,
  type PhysicianAssistContext,
  type PhysicianAssistItem,
  type PhysicianAssistKind,
} from "@/features/ia/types/physician-assist-types";

import { Button } from "@/components/ui/button";
import { buildPhysicianAssistItems } from "@/lib/utils/clinical-assistant";

type ItemState = "pending" | "applied" | "dismissed";

type Props = {
  context: PhysicianAssistContext;
  kinds: PhysicianAssistKind[];
  onApply: (item: PhysicianAssistItem) => void;
  /** When true, interaction alerts must be acknowledged before form submit (Rx). */
  requireAlertAcknowledgement?: boolean;
  onAlertsAcknowledged?: (acknowledged: boolean) => void;
  compact?: boolean;
  className?: string;
};

function AssistItemCard({
  item,
  state,
  onApply,
  onDismiss,
}: {
  item: PhysicianAssistItem;
  state: ItemState;
  onApply: () => void;
  onDismiss: () => void;
}) {
  if (state !== "pending") return null;

  const isAlert = item.kind === "interaction_alert";

  return (
    <div
      className={
        isAlert
          ? "drflow-interaction-alert-card rounded-lg border border-amber-300 bg-amber-50 p-3"
          : "drflow-physician-assist-card rounded-lg border p-3 shadow-sm"
      }
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p
          className={
            isAlert
              ? "drflow-interaction-alert-label text-xs font-semibold uppercase tracking-wide text-amber-900"
              : "drflow-physician-assist-card-label text-xs font-semibold uppercase tracking-wide"
          }
        >
          {PHYSICIAN_ASSIST_KIND_LABELS[item.kind]}
        </p>
        {isAlert ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> : null}
      </div>
      <pre
        className={
          isAlert
            ? "drflow-interaction-alert-body mb-3 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-sm text-amber-950"
            : "drflow-physician-assist-card-body mb-3 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-sm"
        }
      >
        {item.body}
      </pre>
      <div className="flex flex-wrap gap-2">
        {isAlert ? (
          <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
            <Check className="h-3.5 w-3.5" />
            Entendido
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" onClick={onApply}>
              Aplicar al formulario
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
              <X className="h-3.5 w-3.5" />
              Descartar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function InteractionAlertsGroup({
  alerts,
  onDismissAll,
}: {
  alerts: PhysicianAssistItem[];
  onDismissAll: () => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <div className="drflow-interaction-alert-card rounded-lg border border-amber-300 bg-amber-50 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="drflow-interaction-alert-label text-xs font-semibold uppercase tracking-wide text-amber-900">
          {alerts.length === 1
            ? PHYSICIAN_ASSIST_KIND_LABELS.interaction_alert
            : `${alerts.length} alertas de interacción`}
        </p>
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      </div>
      <ul className="drflow-interaction-alert-body mb-3 max-h-44 space-y-2 overflow-y-auto text-sm text-amber-950">
        {alerts.map((item) => (
          <li key={item.id} className="leading-snug">
            {item.body}
          </li>
        ))}
      </ul>
      <Button type="button" size="sm" variant="outline" onClick={onDismissAll}>
        <Check className="h-3.5 w-3.5" />
        Entendido
      </Button>
    </div>
  );
}

/** Inline assist embedded in physician workflows — all output requires explicit confirmation. */
export function InlinePhysicianAssist({
  context,
  kinds,
  onApply,
  requireAlertAcknowledgement = false,
  onAlertsAcknowledged,
  compact = false,
  className = "",
}: Props) {
  const items = useMemo(() => buildPhysicianAssistItems(context, kinds), [context, kinds]);

  const [states, setStates] = useState<Record<string, ItemState>>({});

  const getState = useCallback(
    (id: string): ItemState => states[id] ?? "pending",
    [states]
  );

  const setItemState = useCallback((id: string, next: ItemState) => {
    setStates((prev) => ({ ...prev, [id]: next }));
  }, []);

  const pendingAlerts = items.filter(
    (i) => i.kind === "interaction_alert" && getState(i.id) === "pending"
  );
  const pendingContent = items.filter(
    (i) => i.kind !== "interaction_alert" && getState(i.id) === "pending"
  );

  const allAlertsAcknowledged =
    !requireAlertAcknowledgement ||
    items.filter((i) => i.kind === "interaction_alert").length === 0 ||
    pendingAlerts.length === 0;

  useEffect(() => {
    onAlertsAcknowledged?.(allAlertsAcknowledged);
  }, [allAlertsAcknowledged, onAlertsAcknowledged]);

  if (items.length === 0) return null;

  const visiblePending = items.some((i) => getState(i.id) === "pending");
  if (!visiblePending && compact) return null;

  return (
    <div
      className={`drflow-physician-assist-panel max-h-[min(28rem,55vh)] overflow-y-auto rounded-xl border p-3 ${className}`}
      data-physician-assist
      data-alerts-acknowledged={allAlertsAcknowledged ? "true" : "false"}
    >
      <div className="drflow-physician-assist-title mb-2 flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        Asistencia clínica
      </div>
      <p className="drflow-physician-assist-disclaimer mb-3 text-xs">{PHYSICIAN_ASSIST_DISCLAIMER}</p>

      {pendingAlerts.length > 0 ? (
        <div className="mb-3">
          {pendingAlerts.length === 1 ? (
            <AssistItemCard
              item={pendingAlerts[0]!}
              state={getState(pendingAlerts[0]!.id)}
              onApply={() => setItemState(pendingAlerts[0]!.id, "applied")}
              onDismiss={() => setItemState(pendingAlerts[0]!.id, "dismissed")}
            />
          ) : (
            <InteractionAlertsGroup
              alerts={pendingAlerts}
              onDismissAll={() => {
                for (const item of pendingAlerts) {
                  setItemState(item.id, "dismissed");
                }
              }}
            />
          )}
        </div>
      ) : null}

      {pendingContent.length > 0 ? (
        <div className="space-y-2">
          {pendingContent.map((item) => (
            <AssistItemCard
              key={item.id}
              item={item}
              state={getState(item.id)}
              onApply={() => {
                onApply(item);
                setItemState(item.id, "applied");
              }}
              onDismiss={() => setItemState(item.id, "dismissed")}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function usePhysicianAssistAlertGate() {
  const [alertsAcknowledged, setAlertsAcknowledged] = useState(true);
  return { alertsAcknowledged, setAlertsAcknowledged };
}
