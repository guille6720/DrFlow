"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { SuperadminClinicCommercialRow } from "@/core/entitlements/superadmin-clinics.server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  superadminReactivateClinic,
  superadminSoftDeleteClinic,
  superadminSuspendClinic,
} from "@/lib/actions/clinic-lifecycle";

const planVariant: Record<string, "default" | "info" | "success" | "warning" | "danger" | "brand"> = {
  trial: "info",
  essential: "default",
  basic: "default",
  pro: "brand",
  premium: "success",
  enterprise: "warning",
  legacy: "danger",
};

export function SuperadminClinicsTable({ rows }: { rows: SuperadminClinicCommercialRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuperadminClinicCommercialRow | null>(null);
  const [confirmName, setConfirmName] = useState("");

  function run(
    key: string,
    action: () => Promise<{ error?: string; message?: string; success?: boolean }>
  ) {
    setActing(key);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setActing(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Listo.");
      setDeleteTarget(null);
      setConfirmName("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Clínica</th>
              <th className="px-3 py-2">Admin</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Billing</th>
              <th className="px-3 py-2">Promo/Regular</th>
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
            {rows.map((row) => {
              const active = row.clinicActive !== false;
              const displayName = row.clinicName.replace(/^\[ELIMINADA\]\s*/i, "");
              return (
                <tr key={row.clinicId} className="align-top">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {row.clinicName}
                    {!active ? (
                      <div className="mt-0.5 text-[11px] font-semibold uppercase text-amber-700">
                        Suspendida / baja
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    <div>{row.ownerName ?? "—"}</div>
                    <div className="text-xs text-slate-400">{row.ownerEmail ?? ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={planVariant[row.planKey ?? ""] ?? "default"}>
                      {row.planKey ?? "sin plan"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{row.billingPlanId ?? "—"}</td>
                  <td className="px-3 py-2 text-xs tabular-nums text-slate-600">
                    {row.promoPriceArs != null || row.regularPriceArs != null ? (
                      <>
                        {row.promoPriceArs ?? "—"} / {row.regularPriceArs ?? "—"}
                        {row.promoEndsAt ? (
                          <div className="text-[10px] text-slate-400">
                            hasta {new Date(row.promoEndsAt).toLocaleDateString("es-AR")}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {!active ? "inactive" : (row.status ?? "—")}
                  </td>
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
                    <div className="flex min-w-[200px] flex-col gap-1.5">
                      <Link
                        href={`/superadmin/clinics/${row.clinicId}`}
                        className="font-medium text-teal-700 hover:underline"
                      >
                        Ver detalle
                      </Link>
                      {active ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          loading={acting === `${row.clinicId}-suspend`}
                          onClick={() => {
                            if (
                              !confirm(
                                `¿Suspender «${displayName}»?\nSe bloquea el acceso de todos los usuarios (cualquier rol). Pacientes e HC se conservan.`
                              )
                            ) {
                              return;
                            }
                            run(`${row.clinicId}-suspend`, () =>
                              superadminSuspendClinic(row.clinicId)
                            );
                          }}
                        >
                          Suspender
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          loading={acting === `${row.clinicId}-reactivate`}
                          onClick={() =>
                            run(`${row.clinicId}-reactivate`, () =>
                              superadminReactivateClinic(row.clinicId)
                            )
                          }
                        >
                          Reactivar
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                        disabled={pending}
                        onClick={() => {
                          setDeleteTarget(row);
                          setConfirmName("");
                          setError(null);
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                  No hay clínicas con estos filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {deleteTarget ? (
        <div className="rounded-lg border border-red-200 bg-red-50/80 p-4">
          <h4 className="text-sm font-semibold text-red-950">Eliminar clínica (baja lógica)</h4>
          <p className="mt-2 text-sm text-red-900">
            Se va a dar de baja <strong>{deleteTarget.clinicName.replace(/^\[ELIMINADA\]\s*/i, "")}</strong>.
            Se bloquea el acceso de todos los usuarios (admins, médicos, secretaría).{" "}
            <strong>No se borran pacientes ni historias clínicas.</strong>
          </p>
          <div className="mt-3 max-w-md">
            <Input
              label="Escribí el nombre exacto de la clínica para confirmar"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={deleteTarget.clinicName.replace(/^\[ELIMINADA\]\s*/i, "")}
              autoComplete="off"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-red-700 text-white hover:bg-red-800"
              disabled={pending}
              loading={acting === `${deleteTarget.clinicId}-delete`}
              onClick={() =>
                run(`${deleteTarget.clinicId}-delete`, () =>
                  superadminSoftDeleteClinic(deleteTarget.clinicId, confirmName)
                )
              }
            >
              Confirmar eliminación
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setConfirmName("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
