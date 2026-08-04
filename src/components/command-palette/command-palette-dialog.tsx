"use client";

import { useEffect, useMemo, useRef } from "react";
import { Search } from "lucide-react";
import type { CommandPaletteItemDef } from "@/lib/constants/command-palette-items";
import { COMMAND_PALETTE_SHORTCUTS } from "@/lib/constants/command-palette-items";
import type { CommandPalettePatientHit } from "@/lib/utils/command-palette-search";
import { buildStaticPaletteSections } from "@/lib/utils/command-palette-layout";
import { cn } from "@/lib/utils/cn";

const GROUP_LABELS = {
  acciones: "Acciones rápidas",
  navegacion: "Ir a…",
  pacientes: "Pacientes",
} as const;

type FlatResult =
  | { kind: "static"; item: CommandPaletteItemDef }
  | { kind: "patient"; patient: CommandPalettePatientHit };

type Props = {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  staticItems: CommandPaletteItemDef[];
  patientHits: CommandPalettePatientHit[];
  loadingPatients: boolean;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onNavigate: (href: string) => void;
  flatResults: FlatResult[];
};

export function CommandPaletteDialog({
  open,
  query,
  onQueryChange,
  onClose,
  staticItems,
  patientHits,
  loadingPatients,
  selectedIndex,
  onSelectIndex,
  onNavigate,
  flatResults,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const focusTimer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(focusTimer);
    }
    const resetTimer = setTimeout(() => onQueryChange(""), 0);
    return () => clearTimeout(resetTimer);
  }, [open, onQueryChange]);

  const actionItems = useMemo(
    () => staticItems.filter((item) => item.group === "acciones"),
    [staticItems]
  );
  const navItems = useMemo(
    () => staticItems.filter((item) => item.group === "navegacion"),
    [staticItems]
  );
  const { sections, patientStartIndex } = useMemo(
    () => buildStaticPaletteSections(actionItems, navItems),
    [actionItems, navItems]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/60 p-4 pt-[12vh] backdrop-blur-sm">
      <button type="button" className="absolute inset-0" aria-label="Cerrar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-teal-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar paciente, ir a una sección o ejecutar acción…"
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
            Esc
          </kbd>
        </div>

        <div className="max-h-[min(420px,50vh)] overflow-y-auto py-1">
          {flatResults.length === 0 && !loadingPatients ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {query.trim().length >= 2
                ? "Sin resultados. Probá con otro término."
                : "Escribí para buscar pacientes o filtrar comandos."}
            </p>
          ) : (
            <>
              {sections.map(({ group, rows }) => (
                <div key={group} className="px-2 py-2">
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {GROUP_LABELS[group]}
                  </p>
                  <div className="space-y-0.5">
                    {rows.map(({ item, index }) => {
                      const Icon = item.icon;
                      const active = selectedIndex === index;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => onSelectIndex(index)}
                          onClick={() => onNavigate(item.href)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                            active ? "bg-teal-600/20 ring-1 ring-teal-500/40" : "hover:bg-slate-800"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-teal-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-100">{item.label}</span>
                            {item.description ? (
                              <span className="block truncate text-xs text-slate-400">{item.description}</span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {patientHits.length > 0 ? (
                <div className="px-2 py-2">
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {GROUP_LABELS.pacientes}
                    {loadingPatients ? "…" : ""}
                  </p>
                  <div className="space-y-0.5">
                    {patientHits.map((patient, i) => {
                      const index = patientStartIndex + i;
                      const active = selectedIndex === index;
                      return (
                        <button
                          key={patient.id}
                          type="button"
                          onMouseEnter={() => onSelectIndex(index)}
                          onClick={() => onNavigate(patient.href)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                            active ? "bg-teal-600/20 ring-1 ring-teal-500/40" : "hover:bg-slate-800"
                          )}
                        >
                          <Search className="h-4 w-4 shrink-0 text-cyan-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-100">{patient.label}</span>
                            <span className="block text-xs text-slate-400">{patient.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
          {COMMAND_PALETTE_SHORTCUTS.map((s) => (
            <span key={s.keys}>
              <kbd className="rounded border border-slate-700 px-1 text-slate-400">{s.keys}</kbd> {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
