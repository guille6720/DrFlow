"use client";

import Link from "next/link";

import { useEntitlementsSnapshot } from "@/core/components/entitlements/entitlements-provider";
import { PLAN_KEYS } from "@/core/entitlements/plan-keys";

/**
 * Subtle clinic-facing upgrade hint (non-blocking).
 * Only shows for basic plans when snapshot is available — no auto plan change.
 */
export function ClinicUpgradeHintCard() {
  const snapshot = useEntitlementsSnapshot();
  if (!snapshot?.catalogAvailable) return null;
  if (snapshot.planKey !== PLAN_KEYS.BASIC) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="font-medium text-slate-900">Tu plan actual es Basic.</p>
      <p className="mt-1">
        Si tu consultorio necesita PAMI, reportes avanzados u otras herramientas, Pro puede ser una mejor opción.
      </p>
      <div className="mt-2 flex gap-3">
        <Link href="/planes?modulo=pro" className="font-medium text-teal-700 hover:underline">
          Ver Pro
        </Link>
        <span className="text-slate-400">No ahora</span>
      </div>
    </div>
  );
}
