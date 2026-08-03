"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PatientWorkspaceTabId } from "@/lib/constants/patient-workspace-tabs";

type Props = {
  tab: PatientWorkspaceTabId;
  patientId: string;
  title: string;
  description: string;
};

export function PatientWorkspacePlaceholderPanel({ tab, patientId, title, description }: Props) {
  return (
    <Card title={title}>
      <p className="text-sm text-slate-600">{description}</p>
      <p className="mt-3 text-xs text-slate-500">
        Disponible en una próxima etapa del roadmap enterprise. Mientras tanto, usá las pestañas
        activas del paciente.
      </p>
      {tab === "interconsultas" ? (
        <Link href={`/historias/nueva?patient=${patientId}`} className="mt-4 inline-block">
          <Button type="button" size="sm" variant="outline">
            <Plus className="h-4 w-4" />
            Nueva consulta
          </Button>
        </Link>
      ) : null}
    </Card>
  );
}
