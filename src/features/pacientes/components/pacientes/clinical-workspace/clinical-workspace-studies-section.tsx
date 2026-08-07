import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FlaskConical } from "lucide-react";
import Link from "next/link";

import { cn } from "@/shared/utils/cn";

import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

const LAB_RE = /lab|hemograma|glucosa|bioquim|orina|sangre/i;
const IMAGING_RE = /rx|ecograf|tac|rmn|resonancia|tomograf|ecg/i;

function studyKind(fileName: string, category: string | null): "lab" | "imaging" | "other" {
  const text = `${fileName} ${category ?? ""}`;
  if (LAB_RE.test(text)) return "lab";
  if (IMAGING_RE.test(text)) return "imaging";
  return "other";
}

export function ClinicalWorkspaceStudiesSection({
  chart,
  patientId,
}: {
  chart: PatientChartPayload;
  patientId: string;
}) {
  const sorted = [...chart.studies].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <section aria-labelledby="cw-studies-title" className="drflow-clinical-workspace-section">
      <div className="drflow-clinical-workspace-section-head">
        <h3 id="cw-studies-title">Estudios recientes</h3>
        <Link href={patientWorkspacePath(patientId, "estudios")} className="drflow-patient-chart-link text-xs">
          Ver todos →
        </Link>
      </div>
      {sorted.length === 0 ? (
        <p className="drflow-patient-chart-muted text-sm">Sin estudios adjuntos.</p>
      ) : (
        <ul className="drflow-clinical-workspace-compact-list">
          {sorted.slice(0, 5).map((s) => {
            const kind = studyKind(s.file_name, s.category);
            return (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-sm font-medium">
                    <FlaskConical className={cn("h-3.5 w-3.5 shrink-0", kind === "lab" ? "text-amber-400" : "text-teal-400")} aria-hidden />
                    {s.file_name}
                  </p>
                  <p className="drflow-patient-chart-muted text-[11px]">
                    {format(new Date(s.created_at), "d MMM yyyy", { locale: es })} ·{" "}
                    {kind === "lab" ? "Laboratorio" : kind === "imaging" ? "Imagen" : "Estudio"}
                  </p>
                </div>
                <Link href={`${patientWorkspacePath(patientId, "archivos")}#chart-documentos`} className="drflow-patient-chart-link shrink-0 text-[11px]">
                  Abrir
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
