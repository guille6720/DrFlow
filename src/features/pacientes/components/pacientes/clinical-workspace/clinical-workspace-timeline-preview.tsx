"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import {
  buildClinicalTimeline,
  filterClinicalTimelineEvents,
} from "@/lib/utils/build-clinical-timeline";
import {
  CLINICAL_TIMELINE_FILTER_OPTIONS,
  CLINICAL_TIMELINE_TYPE_LABELS,
  type ClinicalTimelineFilterId,
} from "@/lib/utils/clinical-timeline-types";
import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";

type Props = {
  ehr: PatientEhrWorkspaceData;
  patientId: string;
};

export function ClinicalWorkspaceTimelinePreview({ ehr, patientId }: Props) {
  const [filter, setFilter] = useState<ClinicalTimelineFilterId>("all");

  const events = useMemo(() => {
    const all = buildClinicalTimeline({
      patientId: ehr.patientInfo.id,
      consultations: ehr.consultations,
      attachments: ehr.attachments,
      prescriptions: ehr.prescriptions,
      orders: ehr.orders,
      appointments: ehr.appointments,
    });
    return filterClinicalTimelineEvents(all, filter).slice(0, 8);
  }, [ehr, filter]);

  return (
    <section aria-labelledby="cw-timeline-title" className="drflow-clinical-workspace-section">
      <div className="drflow-clinical-workspace-section-head">
        <h3 id="cw-timeline-title">Timeline clínico</h3>
        <Link href={patientWorkspacePath(patientId, "timeline")} className="drflow-patient-chart-link text-xs">
          Timeline completo →
        </Link>
      </div>

      <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Filtrar eventos">
        {CLINICAL_TIMELINE_FILTER_OPTIONS.slice(0, 6).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 ${
              filter === opt.id
                ? "border-teal-500 bg-teal-950/50 text-teal-200"
                : "border-slate-600 text-slate-400 hover:border-slate-500"
            }`}
            aria-pressed={filter === opt.id}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="drflow-patient-chart-muted text-sm">Sin eventos para este filtro.</p>
      ) : (
        <ol className="drflow-clinical-workspace-timeline">
          {events.map((ev) => (
            <li key={ev.id}>
              <span className="text-[10px] uppercase text-slate-500">
                {CLINICAL_TIMELINE_TYPE_LABELS[ev.type]}
              </span>
              <p className="truncate text-sm font-medium">{ev.title}</p>
              <p className="text-[11px] text-slate-400">
                {format(new Date(ev.at), "d MMM yyyy HH:mm", { locale: es })}
              </p>
              {ev.href ? (
                <Link href={ev.href} className="drflow-patient-chart-link text-[11px]">
                  Abrir →
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
