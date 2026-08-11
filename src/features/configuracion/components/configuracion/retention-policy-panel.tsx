"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useTransition } from "react";

import {
  DATA_RETENTION_CATEGORIES,
  deletionPolicyLabel,
  RETENTION_YEARS_MAX,
  RETENTION_YEARS_MIN,
  retentionCategoryYearsLabel,
} from "@/core/compliance/data-retention-policy";
import { toast } from "@/core/notifications/toast";

import type { ClinicRetentionSummary } from "@/features/configuracion/server/load-clinic-retention-summary";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateClinicRetentionYears } from "@/lib/actions/data-retention";

type Props = {
  summary: ClinicRetentionSummary;
  error?: string | null;
};

export function RetentionPolicyPanel({ summary, error }: Props) {
  const [years, setYears] = useState(String(summary.retentionYears));
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const parsed = Number.parseInt(years, 10);
      const result = await updateClinicRetentionYears(parsed);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Política de retención actualizada.");
    });
  }

  if (error) {
    return (
      <Card title="Retención y eliminación de datos">
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  return (
    <Card
      title="Retención y eliminación de datos"
      description="Política operativa del consultorio conforme Ley 26.529 y Ley 25.326. DrFlow no elimina historias clínicas automáticamente."
    >
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pacientes activos</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{summary.activePatients}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pacientes dados de baja</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{summary.inactivePatients}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Consultas clínicas</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{summary.clinicalRecordCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">En período de retención</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{summary.recordsWithinRetention}</p>
          </div>
        </div>

        {summary.oldestRecordAt ? (
          <p className="text-slate-600">
            Rango de consultas:{" "}
            {format(new Date(summary.oldestRecordAt), "PP", { locale: es })}
            {summary.newestRecordAt
              ? ` — ${format(new Date(summary.newestRecordAt), "PP", { locale: es })}`
              : null}
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="min-w-[180px]">
            <Input
              type="number"
              label={`Retención mínima de HC (${RETENTION_YEARS_MIN}–${RETENTION_YEARS_MAX} años)`}
              min={RETENTION_YEARS_MIN}
              max={RETENTION_YEARS_MAX}
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </div>
          <Button type="button" loading={pending} onClick={handleSave}>
            Guardar política
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Retención</th>
                <th className="px-3 py-2">Eliminación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DATA_RETENTION_CATEGORIES.map((category) => (
                <tr key={category.id}>
                  <td className="px-3 py-3 align-top">
                    <p className="font-medium text-slate-900">{category.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{category.description}</p>
                  </td>
                  <td className="px-3 py-3 align-top text-slate-700">
                    {retentionCategoryYearsLabel(category, summary.retentionYears)}
                  </td>
                  <td className="px-3 py-3 align-top text-slate-700">
                    {deletionPolicyLabel(category.deletionPolicy)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-600">
          La baja de un paciente es lógica: oculta la ficha pero conserva historias, recetas,
          consentimientos y auditoría. Ante pedidos ARCO, usá la exportación Habeas Data antes de
          cualquier acción manual fuera del sistema.
        </p>
      </div>
    </Card>
  );
}
