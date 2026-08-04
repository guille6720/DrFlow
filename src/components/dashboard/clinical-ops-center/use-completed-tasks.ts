"use client";

"use client";

import { useCallback, useMemo, useState } from "react";
import type { ClinicalOpsTask } from "@/lib/utils/clinical-operations-dashboard-types";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useCompletedTasks(tasks: ClinicalOpsTask[]) {
  const storageKey = `drflow-ops-tasks-done-${todayKey()}`;
  const [done, setDone] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(storageKey);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const markDone = useCallback(
    (id: string) => {
      setDone((prev) => {
        const next = new Set(prev);
        next.add(id);
        localStorage.setItem(storageKey, JSON.stringify([...next]));
        return next;
      });
    },
    [storageKey]
  );

  const openTasks = useMemo(
    () => tasks.filter((t) => !done.has(t.id)),
    [tasks, done]
  );

  return { openTasks, markDone };
}
