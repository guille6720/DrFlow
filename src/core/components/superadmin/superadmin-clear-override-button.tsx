"use client";

import { useTransition } from "react";

import { clearFeatureOverrideAction } from "@/lib/actions/entitlements-admin";

export function SuperadminClearOverrideButton({
  clinicId,
  featureKey,
}: {
  clinicId: string;
  featureKey: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set("clinicId", clinicId);
          fd.set("featureKey", featureKey);
          await clearFeatureOverrideAction(fd);
        });
      }}
    >
      Quitar
    </button>
  );
}
