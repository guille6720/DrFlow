"use client";

import { ChevronDown, ChevronUp, ClipboardList, ExternalLink } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PROFESSIONAL_INTAKE_SECTIONS } from "@/lib/constants/professional-intake-checklist";

type Props = {
  showReference: boolean;
  onToggleReference: () => void;
};

export function ProfessionalIntakeChecklistCard({ showReference, onToggleReference }: Props) {
  return (
    <Card title="Checklist de ingreso (Argentina)" className="border-slate-200">
      <p className="mb-3 text-xs text-slate-600">
        Referencia de campos habituales en fichas de médicos (colegios, obras sociales y MSAL).
        DrFlow registra lo esencial; el resto queda como guía.
      </p>
      <button
        type="button"
        onClick={onToggleReference}
        className="mb-3 flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
      >
        <span className="inline-flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-teal-600" />
          Ver checklist completo
        </span>
        {showReference ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {showReference ? (
        <div className="max-h-80 space-y-4 overflow-y-auto text-xs">
          {PROFESSIONAL_INTAKE_SECTIONS.map((section) => (
            <div key={section.id}>
              <p className="font-semibold text-slate-900">{section.title}</p>
              <ul className="mt-2 space-y-1.5 text-slate-600">
                {section.items.map((item) => (
                  <li key={item.id}>
                    · {item.label}
                    {item.detail ? (
                      <span className="block pl-3 text-slate-500">{item.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="space-y-2 border-t border-slate-100 pt-3 text-slate-500">
            <a
              href="https://www.argentina.gob.ar/servicio/sacar-la-matricula-de-profesional-de-la-salud-con-diploma-en-soporte-papel-y-digital"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-teal-700 hover:underline"
            >
              Matrícula nacional (RUPS) <ExternalLink className="h-3 w-3" />
            </a>
            <br />
            <a
              href="https://www.argentina.gob.ar/servicio/habilitacion-de-un-consultorio-medico"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-teal-700 hover:underline"
            >
              Habilitación consultorio CABA <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
