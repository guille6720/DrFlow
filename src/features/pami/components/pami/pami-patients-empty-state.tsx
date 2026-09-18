"use client";

import { HeartHandshake, Plus, RefreshCw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

import { usePamiMessages } from "@/features/pami/i18n";

import { Button, ButtonLink } from "@/components/ui/button";

type Props = {
  hasSearch?: boolean;
  searchQuery?: string;
};

export function PamiPatientsEmptyState({ hasSearch = false, searchQuery = "" }: Props) {
  const t = usePamiMessages().planillas.emptyState;
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const titleId = useId();

  function handleRefresh() {
    startRefresh(() => {
      router.refresh();
    });
  }

  const title = hasSearch ? t.noResultsTitle : t.noPatientsTitle;
  const description = hasSearch
    ? t.noResultsDescription(searchQuery.trim())
    : t.noPatientsDescription;

  return (
    <section
      className="drflow-card-light rounded-2xl border-2 border-amber-400/90 bg-gradient-to-br from-amber-50 via-orange-50/40 to-blue-50 px-6 py-12 text-center shadow-md shadow-amber-200/40 ring-1 ring-amber-300/50"
      aria-labelledby={titleId}
    >
      <div
        className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl drflow-accent-fill text-white ring-2 ring-[color-mix(in_srgb,var(--primary)_40%,transparent)]"
        aria-hidden
      >
        <HeartHandshake className="h-10 w-10" strokeWidth={1.75} />
      </div>

      <h3 id={titleId} className="text-xl font-semibold text-slate-900">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600">{description}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/pacientes/nuevo" aria-label={t.createPatientAria}>
          <Plus className="h-4 w-4" aria-hidden />
          {t.createPatient}
        </ButtonLink>
        <ButtonLink
          href="/datos#import-consumers"
          variant="secondary"
          aria-label={t.importPatientsAria}
        >
          <Upload className="h-4 w-4" aria-hidden />
          {t.importPatients}
        </ButtonLink>
        <Button
          type="button"
          variant="outline"
          className="border-amber-300/90 bg-white/90"
          loading={refreshing}
          disabled={refreshing}
          aria-busy={refreshing}
          aria-label={refreshing ? t.refreshAriaLoading : t.refreshAriaIdle}
          onClick={handleRefresh}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          {t.refresh}
        </Button>
      </div>
    </section>
  );
}
