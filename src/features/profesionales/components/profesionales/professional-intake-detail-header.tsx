"use client";

import { cn } from "@/shared/utils/cn";

import {
  PROFESSIONAL_INTAKE_DETAIL_TABS,
  type ProfessionalIntakeDetail,
  type ProfessionalIntakeDetailTab,
} from "@/features/profesionales/components/profesionales/professional-intake-types";

type Props = {
  selected: ProfessionalIntakeDetail;
  detailTab: ProfessionalIntakeDetailTab;
  onTabChange: (tab: ProfessionalIntakeDetailTab) => void;
};

export function ProfessionalIntakeDetailHeader({ selected, detailTab, onTabChange }: Props) {
  return (
    <div className="drflow-card-light rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {selected.display_name ?? "Profesional"}
          </h2>
          <p className="text-sm text-slate-500">
            {selected.specialties?.name ?? "Sin especialidad"}
            {selected.license_national ? ` · MN ${selected.license_national}` : ""}
          </p>
        </div>
        {selected.intake_completed_at ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Ficha completa
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            Alta parcial
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-100 pb-1">
        {PROFESSIONAL_INTAKE_DETAIL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "rounded-t-lg px-4 py-2 text-sm font-semibold transition",
              detailTab === tab.id
                ? "border-b-2 border-teal-500 text-teal-800"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
