"use client";

import { useMemo, useState, useTransition } from "react";

import {
  assignClinicPlanAction,
  previewClinicPlanChangeAction,
} from "@/lib/actions/superadmin-commercial";

type PlanDiff = {
  currentPlanKey: string;
  newPlanKey: string;
  featuresGained: string[];
  featuresLost: string[];
  limitsIncreased: string[];
  limitsDecreased: string[];
  isDowngrade: boolean;
};

export function SuperadminClinicPlanForm({
  clinicId,
  currentPlanKey,
  planKeys,
}: {
  clinicId: string;
  currentPlanKey: string | null;
  planKeys: string[];
}) {
  const [planKey, setPlanKey] = useState(currentPlanKey ?? "basic");
  const [reason, setReason] = useState("");
  const [diff, setDiff] = useState<PlanDiff | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(() => planKey !== (currentPlanKey ?? ""), [planKey, currentPlanKey]);

  return (
    <div className="space-y-3 text-sm">
      {!currentPlanKey ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
          Esta clínica no tiene plan comercial asignado. Elegí uno y confirmá con motivo.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <select
          value={planKey}
          onChange={(e) => {
            setPlanKey(e.target.value);
            setDiff(null);
            setMessage(null);
          }}
          className="rounded-md border border-slate-300 px-2 py-2 dark:border-slate-600 dark:bg-slate-900"
        >
          {planKeys.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (auditoría)"
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
        />
        <button
          type="button"
          disabled={!dirty || pending}
          className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-600"
          onClick={() => {
            startTransition(async () => {
              const fromKey = currentPlanKey ?? planKey;
              const result = await previewClinicPlanChangeAction(fromKey, planKey);
              if (!result.ok || !result.diff) {
                setMessage(result.error ?? "No se pudo comparar");
                return;
              }
              setDiff(result.diff);
              setMessage(null);
            });
          }}
        >
          Ver diferencias
        </button>
      </div>

      {diff ? (
        <div
          className={`rounded-md border p-3 ${
            diff.isDowngrade ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"
          }`}
        >
          {diff.isDowngrade ? (
            <p className="mb-2 font-medium text-amber-900">
              Advertencia de downgrade: pueden restringirse features o bajar límites. Los datos clínicos no se borran.
            </p>
          ) : null}
          <DiffList title="Features ganadas" items={diff.featuresGained} />
          <DiffList title="Features perdidas" items={diff.featuresLost} />
          <DiffList title="Límites aumentados" items={diff.limitsIncreased} />
          <DiffList title="Límites reducidos" items={diff.limitsDecreased} />
          <button
            type="button"
            disabled={pending || !reason.trim()}
            className="mt-3 rounded-md bg-slate-900 px-3 py-2 font-medium text-white disabled:opacity-50"
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("clinicId", clinicId);
                fd.set("planKey", planKey);
                fd.set("reason", reason);
                const result = await assignClinicPlanAction(fd);
                setMessage(result.ok ? "Plan actualizado." : result.error);
              });
            }}
          >
            Confirmar cambio de plan
          </button>
        </div>
      ) : null}
      {message ? <p className="text-slate-700">{message}</p> : null}
    </div>
  );
}

function DiffList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="font-medium text-slate-800">{title}</p>
      <ul className="list-disc pl-5 text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
