"use client";

import type { ClinicalWorkspaceAlert } from "@/lib/utils/clinical-workspace-alerts";
import { cn } from "@/lib/utils/cn";

const KIND_LABELS: Record<ClinicalWorkspaceAlert["kind"], string> = {
  drug_allergy: "Alergia medicamentosa",
  food_allergy: "Alergia alimentaria",
  critical_diagnosis: "Diagnóstico crítico",
  fall_risk: "Riesgo de caída",
  pregnancy: "Embarazo",
  anticoagulant: "Anticoagulación",
  implant: "Implante",
  isolation: "Aislamiento",
  transplant: "Trasplante",
  dnr: "DNR",
  safety: "Seguridad",
  reminder: "Recordatorio",
  other: "Alerta",
};

export function ClinicalWorkspaceAlertsStrip({ alerts }: { alerts: ClinicalWorkspaceAlert[] }) {
  if (alerts.length === 0) {
    return (
      <section
        aria-label="Alertas clínicas"
        className="drflow-clinical-workspace-alerts drflow-clinical-workspace-alerts-empty"
      >
        <p className="text-sm text-slate-400">Sin alertas clínicas activas registradas.</p>
      </section>
    );
  }

  return (
    <section aria-label="Alertas clínicas" className="drflow-clinical-workspace-alerts">
      <h3 className="sr-only">Alertas clínicas prioritarias</h3>
      <ul className="drflow-clinical-workspace-alerts-list">
        {alerts.slice(0, 12).map((alert) => (
          <li key={alert.id}>
            <span
              className={cn(
                "drflow-clinical-workspace-alert-badge",
                alert.severity === "critical" && "drflow-clinical-workspace-alert-critical",
                alert.severity === "high" && "drflow-clinical-workspace-alert-high",
                alert.severity === "normal" && "drflow-clinical-workspace-alert-normal"
              )}
            >
              <span className="font-semibold">{KIND_LABELS[alert.kind]}:</span> {alert.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
