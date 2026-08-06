"use client";

import { CheckCircle2, ChevronDown, Circle, ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MODULAR_QA_AUDIT, modularAuditStats } from "@/core/qa/modular-audit-data";

import { cn } from "@/shared/utils/cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STORAGE_KEY = "drflow-qa-modular-audit-v1";

interface Props {
  userId?: string;
}

export function QaModularAuditView({ userId }: Props) {
  const storageKey = userId ? `${STORAGE_KEY}-${userId}` : STORAGE_KEY;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({
    pacientes: true,
    recetas: true,
  });

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

  const stats = useMemo(() => modularAuditStats(checked), [checked]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function resetAll() {
    if (confirm("¿Borrar todo el progreso de la auditoría modular?")) {
      setChecked({});
    }
  }

  function toggleModule(id: string) {
    setOpenModules((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!loaded) {
    return <p className="text-sm text-slate-500">Cargando auditoría…</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Progreso auditoría modular</p>
            <p className="text-3xl font-bold text-blue-700">
              {stats.done}/{stats.total}
              <span className="ml-2 text-lg font-normal text-slate-500">({stats.percent}%)</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">{stats.modules} módulos · ~808 archivos src/</p>
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
      </Card>

      {MODULAR_QA_AUDIT.map((mod) => {
        const modDone = mod.checks.filter((c) => checked[c.id]).length;
        const isOpen = openModules[mod.id] ?? false;

        return (
          <Card key={mod.id}>
            <button
              type="button"
              onClick={() => toggleModule(mod.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{mod.id}</h3>
                  <Badge variant={mod.status === "ready" ? "success" : mod.status === "lab" ? "warning" : "default"}>
                    {mod.status}
                  </Badge>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{mod.layer}</span>
                  <span className="text-xs text-slate-500">
                    {modDone}/{mod.checks.length} checks
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{mod.summary}</p>
                <p className="mt-1 text-xs text-slate-500">
                  <strong>Entradas:</strong> {mod.inputs}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  <strong>Salidas:</strong> {mod.outputs}
                </p>
              </div>
              <ChevronDown
                className={cn("mt-1 h-5 w-5 shrink-0 text-slate-400 transition", isOpen && "rotate-180")}
              />
            </button>

            {isOpen ? (
              <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Código — entry points
                  </p>
                  <ul className="space-y-1 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
                    {mod.entryPoints.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>

                <ul className="space-y-2">
                  {mod.checks.map((item) => {
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
                          {item.href ? (
                            <Link
                              href={item.href}
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Probar
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
