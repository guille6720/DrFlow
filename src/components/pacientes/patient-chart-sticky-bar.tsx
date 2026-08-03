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
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";

type Props = {
  patientId: string;
  arcoExport?: React.ReactNode;
  workspaceMode?: boolean;
};

export function PatientChartStickyBar({ patientId, arcoExport, workspaceMode = false }: Props) {
  const hcHref = patientWorkspacePath(patientId, "evoluciones");
  const recetaHref = workspaceMode
    ? patientWorkspacePath(patientId, "recetas")
    : `/recetas?patient=${patientId}`;
  const ordenHref = workspaceMode
    ? patientWorkspacePath(patientId, "ordenes")
    : `/recetas?patient=${patientId}&tipo=orden`;
  const estudiosHref = workspaceMode
    ? patientWorkspacePath(patientId, "estudios")
    : `#chart-estudios`;
  const archivosHref = workspaceMode
    ? patientWorkspacePath(patientId, "archivos")
    : `#chart-documentos`;

  return (
    <div className="drflow-patient-chart-sticky-bar">
      <div className="drflow-patient-chart-sticky-inner">
        <Link href={`/historias/nueva?patient=${patientId}`}>
          <Button size="sm" type="button">
            <Stethoscope className="h-4 w-4" />
            Nueva consulta
          </Button>
        </Link>
        <Link href={hcHref}>
          <Button size="sm" variant="outline" type="button">
            <ClipboardList className="h-4 w-4" />
            Evoluciones
          </Button>
        </Link>
        <Link href={recetaHref}>
          <Button size="sm" variant="outline" type="button">
            <Pill className="h-4 w-4" />
            Recetas
          </Button>
        </Link>
        <Link href={ordenHref}>
          <Button size="sm" variant="outline" type="button">
            <ClipboardList className="h-4 w-4" />
            Órdenes
          </Button>
        </Link>
        <Link href={`/historias/nueva?patient=${patientId}`}>
          <Button size="sm" variant="outline" type="button">
            <FileText className="h-4 w-4" />
            Certificado
          </Button>
        </Link>
        {workspaceMode ? (
          <Link href={estudiosHref}>
            <Button size="sm" variant="outline" type="button">
              <Activity className="h-4 w-4" />
              Estudios
            </Button>
          </Link>
        ) : (
          <a href={estudiosHref}>
            <Button size="sm" variant="outline" type="button">
              <Activity className="h-4 w-4" />
              Estudios
            </Button>
          </a>
        )}
        {workspaceMode ? (
          <Link href={archivosHref}>
            <Button size="sm" variant="outline" type="button">
              <Upload className="h-4 w-4" />
              Archivos
            </Button>
          </Link>
        ) : (
          <a href={archivosHref}>
            <Button size="sm" variant="outline" type="button">
              <Upload className="h-4 w-4" />
              Subir PDF
            </Button>
          </a>
        )}
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
