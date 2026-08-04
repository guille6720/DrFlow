"use client";

import type { Cie10Suggestion } from "@/lib/utils/consultation-documentation";

type PathologyHit = {
  id: string;
  name: string;
  cie10_code: string;
};

type Props = {
  ruleSuggestions: Cie10Suggestion[];
  pathologies: PathologyHit[];
  className?: string;
};

function mergeSuggestions(
  ruleSuggestions: Cie10Suggestion[],
  pathologies: PathologyHit[]
): Array<{ diagnosis: string; code: string; source: string }> {
  const merged: Array<{ diagnosis: string; code: string; source: string }> = [];
  const seen = new Set<string>();

  for (const s of ruleSuggestions) {
    if (seen.has(s.code)) continue;
    seen.add(s.code);
    merged.push({ diagnosis: s.diagnosis, code: s.code, source: "reglas clínicas" });
  }

  for (const p of pathologies) {
    if (!p.cie10_code || seen.has(p.cie10_code)) continue;
    seen.add(p.cie10_code);
    merged.push({ diagnosis: p.name, code: p.cie10_code, source: "guía farmacológica" });
  }

  return merged.slice(0, 6);
}

/** CIE-10 reference panel — always shown when suggestions exist (Phase B). */
export function ConsultationCie10Panel({ ruleSuggestions, pathologies, className = "" }: Props) {
  const rows = mergeSuggestions(ruleSuggestions, pathologies);
  if (rows.length === 0) return null;

  return (
    <div className={`rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 text-sm text-slate-700 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">CIE-10 sugerido (referencia)</p>
      <ul className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <li key={`${row.code}-${row.diagnosis}`} className="flex flex-wrap items-baseline gap-x-2">
            <span>{row.diagnosis}</span>
            <span className="font-mono text-xs font-medium text-teal-700">{row.code}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">{row.source}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-teal-800">Confirmar código antes de registrar diagnóstico o receta.</p>
    </div>
  );
}
