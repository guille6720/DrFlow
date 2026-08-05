"use client";

import {
  PamiPlanillaCategorySection,
  PamiPlanillaFieldsSection,
  PamiPlanillaPreviewSection,
} from "@/features/pami/components/pami/pami-planilla-sections";

import type {
  PamiPlanillaPatient,
  PamiPlanillaProfessional,
} from "@/lib/hooks/use-pami-planillas";
import { usePamiPlanillas } from "@/lib/hooks/use-pami-planillas";

interface Props {
  patients: PamiPlanillaPatient[];
  professionals: PamiPlanillaProfessional[];
  defaultProfessionalId?: string;
}

export function PamiPlanillasView({ patients, professionals, defaultProfessionalId }: Props) {
  const planilla = usePamiPlanillas(patients, professionals, defaultProfessionalId);

  return (
    <div className="space-y-6">
      <PamiPlanillaCategorySection category={planilla.category} selectCategory={planilla.selectCategory} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PamiPlanillaFieldsSection patients={patients} professionals={professionals} {...planilla} />
        <PamiPlanillaPreviewSection {...planilla} />
      </div>
    </div>
  );
}
