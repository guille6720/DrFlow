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

type Props = {
  patientId: string;
  arcoExport?: React.ReactNode;
};

export function PatientChartStickyBar({ patientId, arcoExport }: Props) {
  return (
    <div className="drflow-patient-chart-sticky-bar">
      <div className="drflow-patient-chart-sticky-inner">
        <Link href={`/historias/nueva?patient=${patientId}`}>
          <Button size="sm" type="button">
            <Stethoscope className="h-4 w-4" />
            Nueva consulta
          </Button>
        </Link>
        <Link href={`/historias/paciente/${patientId}`}>
          <Button size="sm" variant="outline" type="button">
            <ClipboardList className="h-4 w-4" />
            Historia clínica completa
          </Button>
        </Link>
        <Link href={`/recetas?patient=${patientId}`}>
          <Button size="sm" variant="outline" type="button">
            <Pill className="h-4 w-4" />
            Nueva receta
          </Button>
        </Link>
        <Link href={`/recetas?patient=${patientId}&tipo=orden`}>
          <Button size="sm" variant="outline" type="button">
            <ClipboardList className="h-4 w-4" />
            Nueva orden
          </Button>
        </Link>
        <Link href={`/historias/nueva?patient=${patientId}`}>
          <Button size="sm" variant="outline" type="button">
            <FileText className="h-4 w-4" />
            Nuevo certificado
          </Button>
        </Link>
        <a href="#chart-estudios">
          <Button size="sm" variant="outline" type="button">
            <Activity className="h-4 w-4" />
            Nuevo estudio
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
