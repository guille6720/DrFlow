"use client";

import { Check } from "lucide-react";
import Link from "next/link";

import { useCompletedOpsTasks } from "@/core/hooks/use-completed-ops-tasks";

import { cn } from "@/shared/utils/cn";

import { OpsSection } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-shared";
import { ClinicalOpsEmpty } from "@/features/dashboard/components/dashboard/clinical-ops-empty";
import type { ClinicalOpsTask } from "@/features/dashboard/utils/clinical-operations-dashboard-types";

function TodayTasksSection({
  tasks,
  onComplete,
}: {
  tasks: ClinicalOpsTask[];
  onComplete: (id: string) => void;
}) {
  return (
    <OpsSection id="ops-tasks" title="Tareas de hoy" count={tasks.length}>
      {tasks.length === 0 ? (
        <ClinicalOpsEmpty message="Sin tareas pendientes." />
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2",
                task.priority === "high"
                  ? "border-amber-700/50 bg-amber-950/20"
                  : "border-slate-700/50 bg-slate-900/30"
              )}
            >
              <button
                type="button"
                onClick={() => onComplete(task.id)}
                className="mt-0.5 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
                aria-label={`Marcar completada: ${task.label}`}
              >
                <Check className="h-4 w-4" aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <Link href={task.href} className="block hover:text-teal-300">
                  <p className="text-sm font-medium text-slate-100">{task.label}</p>
                  <p className="truncate text-xs text-slate-400">{task.detail}</p>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OpsSection>
  );
}

export function ClinicalOpsTodayTasksSection({ tasks }: { tasks: ClinicalOpsTask[] }) {
  const { openTasks, markDone } = useCompletedOpsTasks(tasks);
  return <TodayTasksSection tasks={openTasks} onComplete={markDone} />;
}
