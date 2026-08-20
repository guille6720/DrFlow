"use client";

import Link from "next/link";

import type { SuperadminClinicCommercialRow } from "@/core/entitlements/superadmin-clinics.server";

import { Badge } from "@/components/ui/badge";

const planVariant: Record<string, "default" | "info" | "success" | "warning" | "danger" | "brand"> = {
  trial: "info",
  basic: "default",
  pro: "brand",
  premium: "success",
  enterprise: "warning",
  legacy: "danger",
};

export function SuperadminClinicsTable({ rows }: { rows: SuperadminClinicCommercialRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Clínica</th>
            <th className="px-3 py-2">Admin</th>
            <th className="px-3 py-2">Plan</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Users</th>
            <th className="px-3 py-2">Prof.</th>
            <th className="px-3 py-2">Pacientes</th>
            <th className="px-3 py-2">Uso IA/WA</th>
            <th className="px-3 py-2">Recomendado</th>
            <th className="px-3 py-2">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.clinicId} className="align-top">
              <td className="px-3 py-2 font-medium text-slate-900">{row.clinicName}</td>
              <td className="px-3 py-2 text-slate-600">
                <div>{row.ownerName ?? "—"}</div>
                <div className="text-xs text-slate-400">{row.ownerEmail ?? ""}</div>
              </td>
              <td className="px-3 py-2">
                <Badge variant={planVariant[row.planKey ?? ""] ?? "default"}>
                  {row.planKey ?? "sin plan"}
                </Badge>
              </td>
              <td className="px-3 py-2 text-slate-700">{row.status ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums">{row.users}</td>
              <td className="px-3 py-2 tabular-nums">{row.professionals}</td>
              <td className="px-3 py-2 tabular-nums">
                {row.patients}
                {row.limitPatients != null ? (
                  <span className="text-xs text-slate-400"> / {row.limitPatients}</span>
                ) : null}
              </td>
              <td className="px-3 py-2 tabular-nums text-xs text-slate-600">
                {row.usageAi} / {row.usageWhatsapp}
              </td>
              <td className="px-3 py-2">
                {row.shouldRecommendUpgrade ? (
                  <div>
                    <Badge variant="warning">{row.recommendedPlan}</Badge>
                    <p className="mt-1 max-w-[180px] text-xs text-slate-500">
                      {row.recommendationReasons[0]}
                    </p>
                  </div>
                ) : row.planKey === "legacy" ? (
                  <span className="text-xs text-amber-700">Revisión manual</span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/superadmin/clinics/${row.clinicId}`}
                  className="font-medium text-teal-700 hover:underline"
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                No hay clínicas con estos filtros.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
