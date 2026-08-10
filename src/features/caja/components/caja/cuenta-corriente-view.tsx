"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Header } from "@/core/components/layout/header";
import type { PageMeta } from "@/core/supabase/pagination";

import {
  buildCuentaCorrienteUrl,
  type CuentaCorrienteLedgerEntry,
  type CuentaCorrienteSelectedPatient,
} from "@/features/caja/server/load-cuenta-corriente-page";
import { PatientSearchCombobox } from "@/features/pacientes/components/pacientes/patient-search-combobox";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";
import type { Clinic, UserRole } from "@/types/database";

type Props = {
  selectedPatient: CuentaCorrienteSelectedPatient | null;
  entries: CuentaCorrienteLedgerEntry[];
  balance: number;
  pageMeta: PageMeta;
  buildPageHref: (page: number) => string;
  clinics: { clinic_id: string; clinic?: Clinic }[];
  clinicId: string | null;
  role: UserRole | null;
  userName?: string;
};

export function CuentaCorrienteView({
  selectedPatient,
  entries,
  balance,
  pageMeta,
  buildPageHref,
  clinics,
  clinicId,
  role,
  userName,
}: Props) {
  const router = useRouter();

  return (
    <>
      <Header
        title="Cuenta corriente"
        subtitle={
          selectedPatient
            ? `${selectedPatient.last_name}, ${selectedPatient.first_name}`
            : "Buscá un paciente"
        }
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={userName}
      />
      <div className="p-4 sm:p-6">
        <Link href="/caja">
          <Button variant="outline" size="sm" className="mb-4">
            Volver a caja
          </Button>
        </Link>

        <Card title="Paciente">
          <PatientSearchCombobox
            patients={
              selectedPatient
                ? [
                    {
                      id: selectedPatient.id,
                      first_name: selectedPatient.first_name,
                      last_name: selectedPatient.last_name,
                      document_number: selectedPatient.document_number,
                    },
                  ]
                : []
            }
            defaultPatientId={selectedPatient?.id}
            label="Paciente"
            placeholder="Escribí nombre, apellido o DNI…"
            onPatientChange={(patientId) => {
              if (!patientId) return;
              router.push(buildCuentaCorrienteUrl(patientId));
            }}
          />
        </Card>

        {selectedPatient ? (
          <Card title={`Saldo: $${balance.toLocaleString("es-AR")}`} className="mt-4 print:block">
            {(pageMeta.totalPages > 1 || pageMeta.total > 0) && (
              <ListPagination className="mb-4">
                {pageMeta.page > 1 ? (
                  <Link href={buildPageHref(pageMeta.page - 1)}>
                    <Button variant="outline" size="sm">
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Anterior
                    </Button>
                  </Link>
                ) : null}
                <ListPaginationLabel
                  current={pageMeta.page}
                  totalPages={pageMeta.totalPages}
                  suffix={`${pageMeta.total} movimientos`}
                />
                {pageMeta.page < pageMeta.totalPages ? (
                  <Link href={buildPageHref(pageMeta.page + 1)}>
                    <Button variant="outline" size="sm">
                      Siguiente
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                ) : null}
              </ListPagination>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 text-left">Fecha</th>
                  <th>Concepto</th>
                  <th className="text-right">Debe</th>
                  <th className="text-right">Haber</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-700/30">
                    <td className="py-2">
                      {format(new Date(entry.entry_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    </td>
                    <td>{entry.concept}</td>
                    <td className="text-right">
                      {entry.debit ? `$${entry.debit.toLocaleString("es-AR")}` : "—"}
                    </td>
                    <td className="text-right">
                      {entry.credit ? `$${entry.credit.toLocaleString("es-AR")}` : "—"}
                    </td>
                    <td className="text-right font-medium">
                      ${entry.balance_after.toLocaleString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Sin movimientos en esta página.</p>
            ) : null}
          </Card>
        ) : null}
      </div>
    </>
  );
}
