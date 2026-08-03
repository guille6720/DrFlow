"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Search,
  Stethoscope,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PatientWhatsAppButton } from "@/components/ui/patient-whatsapp-button";
import { buildPatientContactMessage } from "@/lib/utils/patient-messages";
import { patientClinicalHistoryPath } from "@/lib/utils/clinical-navigation";
import { isPamiPatient } from "@/lib/utils/patient-age";
import type { YearlyAttendedPatient } from "@/lib/utils/yearly-attended-patients";
import { cn } from "@/lib/utils/cn";

interface Props {
  patients: YearlyAttendedPatient[];
}

export function DashboardYearlyPatientsSection({ patients }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const blob = `${p.last_name} ${p.first_name} ${p.document_number} ${p.insurance_provider ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [patients, query]);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "drflow-card-light w-full rounded-2xl border border-slate-200 bg-white p-5 text-left text-slate-900 shadow-md shadow-slate-200/40 transition-all hover:shadow-lg hover:shadow-teal-100/40",
          open && "ring-2 ring-teal-500/30"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-600">Pacientes con atención</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{patients.length}</p>
            <p className="mt-1 text-xs font-medium text-slate-600">Último año · Clic para ver listado</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-br from-teal-50 to-cyan-100 p-2.5 text-teal-700">
              <Users className="h-5 w-5" />
            </div>
            {open ? (
              <ChevronUp className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-500" />
            )}
          </div>
        </div>
      </button>

      {open && (
        <Card
          title="Pacientes atendidos en el último año"
          action={
            <Link href="/atenciones">
              <Button variant="outline" size="sm">
                Ver registro completo
              </Button>
            </Link>
          }
        >
          {patients.length === 0 ? (
            <p className="text-sm text-slate-500">
              Todavía no hay pacientes con turnos atendidos o consultas registradas en los últimos 12
              meses.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, DNI u obra social…"
                  className="pl-9"
                />
              </div>

              <p className="text-xs text-slate-500">
                {filtered.length} de {patients.length} paciente(s)
              </p>

              <ul className="max-h-[min(520px,60vh)] space-y-3 overflow-y-auto pr-1">
                {filtered.map((p) => {
                  const display = `${p.last_name}, ${p.first_name}`;
                  const lastLabel = format(new Date(p.lastAttentionAt), "d MMM yyyy", { locale: es });
                  return (
                    <li
                      key={p.id}
                      className="drflow-card-light flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm ring-1 ring-slate-100/80 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{display}</p>
                        <p className="mt-0.5 text-xs text-slate-700">
                          DNI {p.document_number}
                          {p.ageLabel ? ` · ${p.ageLabel}` : ""}
                          {p.insurance_provider ? ` · ${p.insurance_provider}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Última atención: {lastLabel} · {p.attentionCount} registro(s)
                        </p>
                        {isPamiPatient(p.insurance_provider) ? (
                          <Badge variant="teal" className="mt-1.5">
                            PAMI
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <PatientWhatsAppButton
                          phone={p.phone}
                          message={buildPatientContactMessage(`${p.first_name} ${p.last_name}`)}
                          size="icon"
                        />
                        <Link href={patientClinicalHistoryPath(p.id)}>
                          <Button size="sm" variant="outline" type="button">
                            <ClipboardList className="h-3.5 w-3.5" />
                            Historia
                          </Button>
                        </Link>
                        <Link href={`/pacientes/${p.id}`}>
                          <Button size="sm" variant="outline" type="button">
                            <FileText className="h-3.5 w-3.5" />
                            Ficha
                          </Button>
                        </Link>
                        <Link href={`/historias/nueva?patient=${p.id}`}>
                          <Button size="sm" type="button">
                            <Stethoscope className="h-3.5 w-3.5" />
                            Consulta
                          </Button>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
