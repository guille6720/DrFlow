import {
  Activity,
  ClipboardList,
  FileText,
  Pill,
  Stethoscope,
  Upload,
} from "lucide-react";
import Link from "next/link";

import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";
import {
  buildConsultaSessionUrl,
  buildPatientWorkspaceUrl,
} from "@/features/pacientes/utils/patient-workspace-actions";
import { PrescriptionEntryLink } from "@/features/recetas/components/recetas/prescription-entry-link";

import { Button, buttonSurfaceClassName } from "@/components/ui/button";

type Props = {
  patientId: string;
  arcoExport?: React.ReactNode;
};

/** Sticky actions for legacy chart views (outside patient workspace tabs). */
export function PatientChartStickyBar({ patientId, arcoExport }: Props) {
  const nuevaConsultaHref = buildConsultaSessionUrl({ patient: patientId });

  return (
    <div className="drflow-patient-chart-sticky-bar">
      <div className="drflow-patient-chart-sticky-inner">
        <Link href={nuevaConsultaHref}>
          <Button size="sm" type="button">
            <Stethoscope className="h-4 w-4" />
            Nueva consulta
          </Button>
        </Link>
        <Link href={patientWorkspacePath(patientId, "soap")}>
          <Button size="sm" variant="outline" type="button">
            <ClipboardList className="h-4 w-4" />
            SOAP
          </Button>
        </Link>
        <PrescriptionEntryLink
          fallbackHref={buildPatientWorkspaceUrl(patientId, { tab: "recetas", action: "nueva" })}
          className={buttonSurfaceClassName("outline", "sm")}
        >
          <Pill className="h-4 w-4" />
          Recetas
        </PrescriptionEntryLink>
        <Link href={buildPatientWorkspaceUrl(patientId, { tab: "ordenes", action: "nueva" })}>
          <Button size="sm" variant="outline" type="button">
            <ClipboardList className="h-4 w-4" />
            Órdenes
          </Button>
        </Link>
        <Link href={buildPatientWorkspaceUrl(patientId, { action: "certificado" })}>
          <Button size="sm" variant="outline" type="button">
            <FileText className="h-4 w-4" />
            Certificado
          </Button>
        </Link>
        <a href="#chart-estudios">
          <Button size="sm" variant="outline" type="button">
            <Activity className="h-4 w-4" />
            Estudios
          </Button>
        </a>
        <a href="#chart-documentos">
          <Button size="sm" variant="outline" type="button">
            <Upload className="h-4 w-4" />
            Subir PDF
          </Button>
        </a>
        {arcoExport}
        <Link href={`/pacientes/${patientId}/editar`}>
          <Button size="sm" variant="outline" type="button">
            Editar ficha
          </Button>
        </Link>
      </div>
    </div>
  );
}
