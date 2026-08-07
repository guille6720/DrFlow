"use client";

import type { PageMeta } from "@/core/supabase/pagination";

import { PamiPatientsEmptyState } from "@/features/pami/components/pami/pami-patients-empty-state";
import {
  PamiPlanillaCategorySection,
  PamiPlanillaFieldsSection,
  PamiPlanillaPreviewSection,
} from "@/features/pami/components/pami/pami-planilla-sections";
import {
  PamiPlanillasPaginationSkeleton,
  PamiPlanillasResultsSkeleton,
} from "@/features/pami/components/pami/pami-planillas-skeleton";
import { useDebouncedPamiPlanillasSearch } from "@/features/pami/hooks/use-debounced-pami-planillas-search";
import { usePamiMessages } from "@/features/pami/i18n";
import type { PamiPlanillaCatalog } from "@/features/pami/types/pami-planilla-template";

import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";
import type {
  PamiPlanillaPatient,
  PamiPlanillaProfessional,
} from "@/lib/hooks/use-pami-planillas";
import { usePamiPlanillas } from "@/lib/hooks/use-pami-planillas";

interface Props {
  patients: PamiPlanillaPatient[];
  professionals: PamiPlanillaProfessional[];
  catalog: PamiPlanillaCatalog;
  defaultProfessionalId?: string;
  pageMeta?: PageMeta;
  searchQuery?: string;
  buildPageHref?: (page: number) => string;
}

export function PamiPlanillasView({
  patients,
  professionals,
  catalog,
  defaultProfessionalId,
  pageMeta,
  searchQuery = "",
  buildPageHref,
}: Props) {
  const t = usePamiMessages().planillas;
  const { q, setQ, submitSearch, isNavigating } = useDebouncedPamiPlanillasSearch(searchQuery);
  const planilla = usePamiPlanillas(patients, professionals, catalog, defaultProfessionalId);
  const hasSearch = Boolean(searchQuery.trim());
  const showEmptyPatients = patients.length === 0;
  const queryPending = q.trim() !== searchQuery.trim();
  const showResultsSkeleton = isNavigating && (queryPending || showEmptyPatients);
  const hasPagination = Boolean(pageMeta && pageMeta.totalPages > 1 && buildPageHref);
  const showPagination = !isNavigating && hasPagination;

  return (
    <div className="space-y-6">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isNavigating ? t.search.ariaLiveSearching : null}
      </div>

      <form
        role="search"
        aria-label={t.search.formAriaLabel}
        onSubmit={submitSearch}
        className="flex flex-wrap gap-2"
      >
        <Input
          id="pami-patient-search"
          label={t.search.label}
          placeholder={t.search.placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[240px] flex-1"
          aria-busy={isNavigating}
          autoComplete="off"
          type="search"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isNavigating}
          loading={isNavigating}
          aria-label={isNavigating ? t.search.submitAriaSearching : t.search.submitAriaIdle}
        >
          {t.search.submit}
        </Button>
      </form>

      {showResultsSkeleton ? (
        <PamiPlanillasResultsSkeleton />
      ) : showEmptyPatients ? (
        <PamiPatientsEmptyState hasSearch={hasSearch} searchQuery={searchQuery} />
      ) : null}

      {isNavigating && hasPagination ? (
        <PamiPlanillasPaginationSkeleton />
      ) : showPagination ? (
        <nav aria-label={t.pagination.navAriaLabel}>
          <ListPagination>
            {pageMeta!.page > 1 ? (
              <ButtonLink
                href={buildPageHref!(pageMeta!.page - 1)}
                variant="outline"
                size="sm"
                aria-label={t.pagination.pagePreviousAria(pageMeta!.page - 1)}
              >
                {t.pagination.previous}
              </ButtonLink>
            ) : null}
            <ListPaginationLabel
              current={pageMeta!.page}
              totalPages={pageMeta!.totalPages}
              suffix={t.pagination.patientsSuffix(pageMeta!.total)}
            />
            {pageMeta!.page < pageMeta!.totalPages ? (
              <ButtonLink
                href={buildPageHref!(pageMeta!.page + 1)}
                variant="outline"
                size="sm"
                aria-label={t.pagination.pageNextAria(pageMeta!.page + 1)}
              >
                {t.pagination.next}
              </ButtonLink>
            ) : null}
          </ListPagination>
        </nav>
      ) : null}

      <section aria-label={t.section.completeFormAriaLabel} className="space-y-6" aria-busy={isNavigating}>
        <PamiPlanillaCategorySection
          categories={catalog.categories}
          category={planilla.category}
          selectCategory={planilla.selectCategory}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <PamiPlanillaFieldsSection
            patients={patients}
            professionals={professionals}
            remotePatientSearch
            patientsLoading={isNavigating}
            {...planilla}
          />
          <PamiPlanillaPreviewSection {...planilla} />
        </div>
      </section>
    </div>
  );
}
