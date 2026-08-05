"use client";

import { ProactiveCareContent } from "@/features/ia/components/clinical-workflow/proactive-care-content";
import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";

import type { ProactiveCareItem } from "@/lib/utils/proactive-follow-up";

type Props = {
  open: boolean;
  onClose: () => void;
  items: ProactiveCareItem[];
  urgentCount: number;
};

export function ProactiveCareSheet({ open, onClose, items, urgentCount }: Props) {
  const subtitle =
    urgentCount > 0
      ? `${urgentCount} alerta${urgentCount > 1 ? "s" : ""} urgente${urgentCount > 1 ? "s" : ""}`
      : `${items.length} recordatorio${items.length > 1 ? "s" : ""}`;

  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Seguimiento proactivo"
      subtitle={subtitle}
      onClose={onClose}
      wide
    >
      <ProactiveCareContent items={items} />
    </PatientWorkspaceOverlay>
  );
}
