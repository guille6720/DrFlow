"use client";

import { ManualIllustration } from "@/core/components/manual/manual-illustration";
import { ExportManualPdfButton } from "@/core/components/manual/export-manual-pdf";
import { MANUAL_SECTIONS, MANUAL_SUBTITLE, MANUAL_TITLE } from "@/core/manual/manual-data";
import { CHANGELOG, getAppVersion } from "@/core/app-release";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

export function ManualView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="info">v{getAppVersion()}</Badge>
            <span className="text-xs text-slate-500">Siempre la versión actual de la app</span>
          </div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <BookOpen className="h-5 w-5 text-blue-700" />
            {MANUAL_TITLE}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{MANUAL_SUBTITLE}</p>
        </div>
        <ExportManualPdfButton />
      </div>

      <Card title="Qué hay de nuevo">
        <ul className="space-y-4">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <p className="font-medium text-slate-900">
                {entry.version} · {entry.title}
              </p>
              <p className="text-xs text-slate-500">{entry.date}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {entry.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Card>

      <nav className="flex flex-wrap gap-2">
        {MANUAL_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#manual-${s.id}`}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-50"
          >
            {s.title.replace(/^\d+\.\s*/, "")}
          </a>
        ))}
      </nav>

      {MANUAL_SECTIONS.map((section) => (
        <section
          key={section.id}
          id={`manual-${section.id}`}
          className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{section.summary}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ManualIllustration kind={section.illustration} />
            <ol className="space-y-3">
              {section.steps.map((step, i) => (
                <li key={step.title} className="flex gap-3 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">{step.title}</p>
                    <p className="mt-0.5 text-slate-600">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {section.tips && section.tips.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {section.tips.map((tip) => (
                <li key={tip}>💡 {tip}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
