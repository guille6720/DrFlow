"use client";

import { Download, FileText, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  type ClinicalRecordExportRow,
  downloadClinicalRecordsCsv,
  downloadClinicalRecordsListPdf,
  downloadPatientsCsv,
  downloadPatientsPdf,
  type PatientExportRow,
} from "@/lib/utils/clinical-export-client";

type Props = {
  patients: PatientExportRow[];
  records: ClinicalRecordExportRow[];
  patientsLimit: number;
  recordsLimit: number;
};

export function DatosBulkDownloadCards({
  patients,
  records,
  patientsLimit,
  recordsLimit,
}: Props) {
  const [busy, setBusy] = useState<"patients-csv" | "patients-pdf" | "records-csv" | "records-pdf" | null>(
    null
  );

  async function run(
    kind: "patients-csv" | "patients-pdf" | "records-csv" | "records-pdf",
    action: () => void | Promise<void>
  ) {
    setBusy(kind);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
        <Users className="mb-2 h-8 w-8 text-blue-700" />
        <p className="font-semibold text-slate-900">Pacientes</p>
        <p className="mt-1 text-sm text-slate-600">
          Descargá todo el padrón activo o abrí la lista para buscar fichas.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {patients.length} paciente{patients.length === 1 ? "" : "s"}
          {patients.length >= patientsLimit ? ` (máx. ${patientsLimit})` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={patients.length === 0 || busy !== null}
            onClick={() =>
              void run("patients-csv", () =>
                downloadPatientsCsv("pacientes-drflow-todos.csv", patients)
              )
            }
          >
            <Download className="h-4 w-4" />
            {busy === "patients-csv" ? "Generando…" : "CSV todo"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={patients.length === 0 || busy !== null}
            onClick={() => void run("patients-pdf", () => downloadPatientsPdf(patients))}
          >
            <Download className="h-4 w-4" />
            {busy === "patients-pdf" ? "Generando…" : "PDF todo"}
          </Button>
          <Link href="/pacientes">
            <Button type="button" size="sm" variant="secondary">
              Abrir pacientes
            </Button>
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
        <FileText className="mb-2 h-8 w-8 text-blue-700" />
        <p className="font-semibold text-slate-900">Historia clínica</p>
        <p className="mt-1 text-sm text-slate-600">
          Descargá todas las consultas recientes o abrí Historia clínica.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {records.length} consulta{records.length === 1 ? "" : "s"}
          {records.length >= recordsLimit ? ` (máx. ${recordsLimit})` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={records.length === 0 || busy !== null}
            onClick={() =>
              void run("records-csv", () =>
                downloadClinicalRecordsCsv("historias-clinicas-drflow-todas.csv", records)
              )
            }
          >
            <Download className="h-4 w-4" />
            {busy === "records-csv" ? "Generando…" : "CSV todo"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={records.length === 0 || busy !== null}
            onClick={() =>
              void run("records-pdf", () =>
                downloadClinicalRecordsListPdf(
                  records,
                  "Todas las historias clínicas (consultas recientes)"
                )
              )
            }
          >
            <Download className="h-4 w-4" />
            {busy === "records-pdf" ? "Generando…" : "PDF todo"}
          </Button>
          <Link href="/historias">
            <Button type="button" size="sm" variant="secondary">
              Abrir historias
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
