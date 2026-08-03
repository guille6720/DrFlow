"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity,
  ArrowUpRight,
  CalendarCheck,
  ClipboardList,
  FileStack,
  FlaskConical,
  History,
  Hospital,
  LogOut,
  Pill,
  ScanLine,
  Stethoscope,
  UserX,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PatientEhrWorkspaceData } from "@/lib/server/load-patient-ehr-data";
import {
  buildClinicalTimeline,
  filterClinicalTimelineEvents,
  groupClinicalTimelineByMonth,
} from "@/lib/utils/build-clinical-timeline";
import {
  CLINICAL_TIMELINE_FILTER_OPTIONS,
  CLINICAL_TIMELINE_TYPE_LABELS,
  type ClinicalTimelineEventType,
  type ClinicalTimelineFilterId,
} from "@/lib/utils/clinical-timeline-types";

const TYPE_ICONS: Record<ClinicalTimelineEventType, typeof Stethoscope> = {
  consultation: Stethoscope,
  vitals: Activity,
  diagnostic: ClipboardList,
  treatment: Pill,
  lab: FlaskConical,
  imaging: ScanLine,
  prescription: Pill,
  order: FileStack,
  referral: ArrowUpRight,
  pami_form: FileStack,
  document: FileStack,
  appointment: CalendarCheck,
  no_show: UserX,
  hospitalization: Hospital,
  discharge: LogOut,
};

function monthHeading(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es });
}

type Props = {
  ehr: PatientEhrWorkspaceData;
};

export function PatientClinicalTimeline({ ehr }: Props) {
  const [filter, setFilter] = useState<ClinicalTimelineFilterId>("all");

  const allEvents = useMemo(
    () =>
      buildClinicalTimeline({
        patientId: ehr.patientInfo.id,
        consultations: ehr.consultations,
        attachments: ehr.attachments,
        prescriptions: ehr.prescriptions,
        orders: ehr.orders,
        appointments: ehr.appointments,
      }),
    [ehr]
  );

  const filteredEvents = useMemo(
    () => filterClinicalTimelineEvents(allEvents, filter),
    [allEvents, filter]
  );

  const grouped = useMemo(() => groupClinicalTimelineByMonth(filteredEvents), [filteredEvents]);

  return (
    <Card
      title="Timeline clínico"
      action={
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <History className="h-3.5 w-3.5" />
          {filteredEvents.length} evento{filteredEvents.length === 1 ? "" : "s"}
        </span>
      }
    >
      <div className="drflow-clinical-timeline-filters">
        {CLINICAL_TIMELINE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={
              filter === option.id
                ? "drflow-clinical-timeline-filter is-active"
                : "drflow-clinical-timeline-filter"
            }
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <p className="text-sm text-slate-500">Sin eventos para este filtro.</p>
      ) : (
        <div className="drflow-clinical-timeline">
          {grouped.map(({ monthKey, events }) => (
            <section key={monthKey} className="drflow-clinical-timeline-month">
              <h3 className="drflow-clinical-timeline-month-label">{monthHeading(monthKey)}</h3>
              <ol className="drflow-clinical-timeline-list">
                {events.map((event) => {
                  const Icon = TYPE_ICONS[event.type];
                  const content = (
                    <>
                      <span className={`drflow-clinical-timeline-dot is-${event.type}`} />
                      <div className="drflow-clinical-timeline-icon">
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="drflow-clinical-timeline-body">
                        <p className="drflow-clinical-timeline-kind">
                          {CLINICAL_TIMELINE_TYPE_LABELS[event.type]}
                        </p>
                        <p className="drflow-clinical-timeline-title">{event.title}</p>
                        {event.subtitle ? (
                          <p className="drflow-clinical-timeline-subtitle">{event.subtitle}</p>
                        ) : null}
                        <p className="drflow-clinical-timeline-meta">
                          {format(new Date(event.at), "PPp", { locale: es })}
                          {event.meta ? ` · ${event.meta}` : ""}
                        </p>
                      </div>
                    </>
                  );

                  return (
                    <li key={event.id} className="drflow-clinical-timeline-item">
                      {event.href ? (
                        <Link href={event.href} className="drflow-clinical-timeline-link">
                          {content}
                        </Link>
                      ) : (
                        <div className="drflow-clinical-timeline-link">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
