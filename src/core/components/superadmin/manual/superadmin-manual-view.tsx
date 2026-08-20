"use client";

import { BookOpen } from "lucide-react";
import { useMemo, useState } from "react";

import {
  MANUAL_SECTIONS,
  SUPERADMIN_MANUAL_META,
} from "@/core/components/superadmin/manual/manual-data";
import { ManualNavigation } from "@/core/components/superadmin/manual/manual-navigation";
import { ManualSearch } from "@/core/components/superadmin/manual/manual-search";
import { ManualSectionBlock } from "@/core/components/superadmin/manual/manual-section";
import { renderManualSectionBody } from "@/core/components/superadmin/manual/manual-section-bodies";
import type { UsageThresholds } from "@/core/entitlements/usage-thresholds";

import { Badge } from "@/components/ui/badge";

function sectionMatches(query: string, section: (typeof MANUAL_SECTIONS)[number]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [section.id, section.title, section.summary, ...section.keywords]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q) || q.split(/\s+/).every((token) => haystack.includes(token));
}

export function SuperadminManualView({ thresholds }: { thresholds: UsageThresholds }) {
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () => MANUAL_SECTIONS.filter((section) => sectionMatches(query, section)),
    [query]
  );
  const visibleIds = useMemo(() => new Set(visible.map((s) => s.id)), [visible]);

  return (
    <div className="space-y-4" data-superadmin-manual>
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-teal-50/40 p-5 dark:border-slate-700 dark:from-slate-900 dark:to-teal-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="info">v{SUPERADMIN_MANUAL_META.version}</Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Actualizado: {SUPERADMIN_MANUAL_META.contentUpdatedAt}
              </span>
            </div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
              <BookOpen className="h-6 w-6 text-teal-700 dark:text-teal-300" aria-hidden />
              {SUPERADMIN_MANUAL_META.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Superadmin es el centro de control comercial y administrativo de DrFlow. Permite a
              administradores autorizados gestionar planes de clínicas, entitlements, límites,
              overrides, consumo y recomendaciones de upgrade sin modificar información clínica.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <ManualSearch value={query} onChange={setQuery} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 lg:hidden">
          {visible.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-teal-800 dark:border-slate-600 dark:bg-slate-950 dark:text-teal-200"
            >
              {section.title}
            </a>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        <ManualNavigation visibleIds={visibleIds} />
        <div className="min-w-0 flex-1 space-y-4">
          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-600">
              Ninguna sección coincide con «{query}».
            </p>
          ) : null}
          {MANUAL_SECTIONS.map((section) => (
            <ManualSectionBlock
              key={section.id}
              section={section}
              hidden={!visibleIds.has(section.id)}
            >
              {renderManualSectionBody(section.id, thresholds)}
            </ManualSectionBlock>
          ))}
        </div>
      </div>
    </div>
  );
}
