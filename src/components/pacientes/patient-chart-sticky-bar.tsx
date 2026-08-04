import Link from "next/link";
import {
  Activity,
  ClipboardList,
  FileText,
  Pill,
  Stethoscope,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";

type Props = {
  patientId: string;
  arcoExport?: React.ReactNode;
};

/** Sticky actions for legacy chart views (outside patient workspace tabs). */
export function PatientChartStickyBar({ patientId, arcoExport }: Props) {
  const nuevaConsultaHref = buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" });

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
        <Link href={buildPatientWorkspaceUrl(patientId, { tab: "recetas", action: "nueva" })}>
          <Button size="sm" variant="outline" type="button">
            <Pill className="h-4 w-4" />
            Recetas
          </Button>
        </Link>
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
