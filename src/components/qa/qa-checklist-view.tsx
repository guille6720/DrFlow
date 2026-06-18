"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QA_CHECKLIST, qaStats } from "@/lib/qa/checklist-data";
import { cn } from "@/lib/utils/cn";
import { CheckCircle2, Circle, ExternalLink, RotateCcw } from "lucide-react";

const STORAGE_KEY = "drflow-qa-checklist-v1";

interface Props {
  userId?: string;
}

export function QaChecklistView({ userId }: Props) {
  const storageKey = userId ? `${STORAGE_KEY}-${userId}` : STORAGE_KEY;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) setChecked(JSON.parse(raw) as Record<string, boolean>);
      } catch {
        /* ignore */
      }
      setLoaded(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked, loaded, storageKey]);

  const stats = useMemo(() => qaStats(checked), [checked]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function resetAll() {
    if (confirm("¿Borrar todo el progreso del checklist QA?")) {
      setChecked({});
    }
  }

  if (!loaded) {
    return <p className="text-sm text-slate-500">Cargando checklist…</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Progreso general</p>
            <p className="text-3xl font-bold text-blue-700">
              {stats.done}/{stats.total}
              <span className="ml-2 text-lg font-normal text-slate-500">({stats.percent}%)</span>
            </p>
          </div>
          <div className="h-3 min-w-[200px] flex-1 rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-blue-600 transition-all"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="h-4 w-4" />
            Reiniciar
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          El progreso se guarda en este navegador. Marcá cada ítem al probarlo manualmente.
        </p>
      </Card>

      {QA_CHECKLIST.map((section) => {
        const sectionDone = section.items.filter((i) => checked[i.id]).length;
        return (
          <Card key={section.id} title={`${section.title} (${sectionDone}/${section.items.length})`}>
            <ul className="space-y-2">
              {section.items.map((item) => {
                const isChecked = Boolean(checked[item.id]);
                return (
                  <li key={item.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                        isChecked
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isChecked}
                        onChange={() => toggle(item.id)}
                      />
                      {isChecked ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                      )}
                      <span className="flex-1 text-sm text-slate-800">{item.label}</span>
                      {item.href && (
                        <Link
                          href={item.href}
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Probar
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
