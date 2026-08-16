"use client";

import { useMemo, useState } from "react";

import {
  formatProtocolNoteForEvolution,
  GEMINI_CLINICAL_PROTOCOLS,
  type GeminiClinicalProtocol,
} from "@/lib/ai/gemini-medical-lexicon";

type Props = {
  onInsertIntoEvolution: (text: string) => void;
  onCancel: () => void;
};

export function DrappProtocolsQuickPanel({ onInsertIntoEvolution, onCancel }: Props) {
  const protocols = useMemo(() => GEMINI_CLINICAL_PROTOCOLS, []);
  const [selectedId, setSelectedId] = useState(protocols[0]?.id ?? "");
  const selected: GeminiClinicalProtocol | null =
    protocols.find((p) => p.id === selectedId) ?? protocols[0] ?? null;

  if (!selected) {
    return (
      <div className="space-y-2 border-t border-[#efe6b8] bg-[#fffdf5] p-3">
        <p className="text-sm text-slate-600">No hay protocolos cargados.</p>
        <button type="button" className="text-sm font-semibold text-[#2f7fbf]" onClick={onCancel}>
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-[#efe6b8] bg-[#fffdf5] p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label className="block min-w-[220px] flex-1 text-sm">
          <span className="mb-1 block font-semibold text-slate-800">Protocolo clínico</span>
          <select
            className="drflow-ui-input w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {protocols.map((protocol) => (
              <option key={protocol.id} value={protocol.id}>
                {protocol.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
            onClick={onCancel}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800"
            onClick={() => onInsertIntoEvolution(formatProtocolNoteForEvolution(selected))}
          >
            Insertar en evolución
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-700">{selected.summary}</p>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-900">Inclusión</h4>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-800">
            {selected.inclusion.map((item) => (
              <li key={item} className="leading-snug">
                • {item}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-rose-200 bg-rose-50/80 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-rose-900">
            Exclusión principal
          </h4>
          {selected.exclusion.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Sin exclusiones listadas en el resumen.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-slate-800">
              {selected.exclusion.map((item) => (
                <li key={item} className="leading-snug">
                  • {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-slate-500">
        Referencia de screening. La elegibilidad final la determina el equipo del estudio según
        protocolo completo.
      </p>
    </div>
  );
}
