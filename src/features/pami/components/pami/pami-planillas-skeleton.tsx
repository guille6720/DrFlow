"use client";

import { getPamiMessages } from "@/features/pami/i18n";

const t = getPamiMessages().planillas.skeleton;

function SkeletonLine({
  className,
  title,
  short,
}: {
  className?: string;
  title?: boolean;
  short?: boolean;
}) {
  return (
    <span
      className={[
        "drflow-patient-workspace-skeleton-line block",
        title ? "is-title" : "",
        short ? "is-short" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

function SkeletonPill({ className }: { className?: string }) {
  return <span className={["drflow-patient-workspace-skeleton-pill block", className].filter(Boolean).join(" ")} />;
}

/** Placeholder del buscador — misma fila flex que el formulario real. */
export function PamiPlanillasSearchSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      <div className="min-w-[240px] flex-1 space-y-2">
        <SkeletonLine short className="!mb-0 !h-3 !w-[38%]" />
        <SkeletonLine className="!mb-0 !h-10 !w-full rounded-xl" />
      </div>
      <SkeletonPill className="!mt-6 h-9 w-[5.5rem] shrink-0 rounded-lg" />
    </div>
  );
}

/** Sustituto del empty state — altura fija para evitar layout shift. */
export function PamiPlanillasResultsSkeleton() {
  return (
    <div
      className="drflow-card-light flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border-2 border-amber-400/90 bg-gradient-to-br from-amber-50 via-orange-50/40 to-blue-50 px-6 py-12 text-center shadow-md shadow-amber-200/40 ring-1 ring-amber-300/50"
      aria-busy="true"
      aria-label={t.resultsAriaLabel}
    >
      <div aria-hidden>
        <SkeletonPill className="mb-5 !h-20 !w-20 shrink-0 rounded-2xl" />
        <SkeletonLine title className="!mx-auto" />
        <SkeletonLine className="!mx-auto !mt-3 !w-[min(100%,28rem)]" />
        <SkeletonLine short className="!mx-auto !mt-2" />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <SkeletonPill className="!h-9 !w-32 rounded-lg" />
          <SkeletonPill className="!h-9 !w-36 rounded-lg" />
          <SkeletonPill className="!h-9 !w-28 rounded-lg" />
        </div>
      </div>
      <p className="sr-only">{t.resultsSrOnly}</p>
    </div>
  );
}

/** Barra de paginación — misma altura que `ListPagination`. */
export function PamiPlanillasPaginationSkeleton() {
  return (
    <div
      className="flex min-h-[3.25rem] flex-wrap items-center justify-center gap-3 rounded-xl border border-slate-500/70 bg-slate-800/95 px-4 py-3 shadow-lg shadow-black/25 ring-1 ring-teal-500/20"
      aria-busy="true"
      aria-label={t.paginationAriaLabel}
    >
      <div className="flex flex-wrap items-center justify-center gap-3" aria-hidden>
        <SkeletonPill className="!h-9 !w-20 rounded-lg" />
        <SkeletonLine className="!mb-0 !h-4 !w-48" />
        <SkeletonPill className="!h-9 !w-20 rounded-lg" />
      </div>
      <p className="sr-only">{t.paginationSrOnly}</p>
    </div>
  );
}

/** Placeholder del selector de paciente — misma altura que el combobox. */
export function PamiPlanillasPatientFieldSkeleton() {
  return (
    <div className="drflow-patient-workspace-skeleton space-y-2" aria-hidden>
      <SkeletonLine short className="!mb-0 !h-3 !w-[28%]" />
      <SkeletonLine className="!mb-0 !h-10 !w-full rounded-xl" />
    </div>
  );
}

function PlanillaCardSkeleton({ fieldCount = 5 }: { fieldCount?: number }) {
  return (
    <div className="drflow-ui-card min-h-[22rem] min-w-0 overflow-visible">
      <div className="drflow-ui-card-header px-5 py-4">
        <SkeletonLine title className="!mb-0" />
      </div>
      <div className="drflow-card-body drflow-ui-card-body space-y-4 p-5">
        {Array.from({ length: fieldCount }).map((_, index) => (
          <div key={index} className="space-y-2">
            <SkeletonLine short className="!mb-0 !h-3 !w-[32%]" />
            <SkeletonLine className="!mb-0 !h-10 !w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder de categorías PAMI — fila de pills como la sección real. */
export function PamiPlanillasCategoriesSkeleton() {
  return (
    <div className="drflow-ui-card min-w-0 overflow-visible">
      <div className="drflow-ui-card-header px-5 py-4">
        <SkeletonLine title className="!mb-0" />
      </div>
      <div className="drflow-card-body drflow-ui-card-body p-5">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonPill key={index} className="!h-14 !w-36 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

type PageSkeletonProps = {
  /** Omite la fila de búsqueda cuando el formulario real ya está visible. */
  includeSearch?: boolean;
};

/** Espejo del layout de planillas PAMI para carga inicial y transiciones de búsqueda. */
export function PamiPlanillasPageSkeleton({ includeSearch = true }: PageSkeletonProps) {
  return (
    <div
      className="drflow-patient-workspace-skeleton space-y-6"
      aria-busy="true"
      aria-label={t.pageAriaLabel}
    >
      {includeSearch ? <PamiPlanillasSearchSkeleton /> : null}
      <PamiPlanillasResultsSkeleton />
      <PamiPlanillasCategoriesSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <PlanillaCardSkeleton fieldCount={5} />
        <PlanillaCardSkeleton fieldCount={2} />
      </div>
      <p className="sr-only">{t.pageSrOnly}</p>
    </div>
  );
}

/** Skeleton compacto bajo el buscador durante navegación con pacientes ya cargados. */
export function PamiPlanillasSearchTransitionSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite" aria-label={t.transitionAriaLabel}>
      <PamiPlanillasPaginationSkeleton />
      <PamiPlanillasCategoriesSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <PlanillaCardSkeleton fieldCount={3} />
        <div className="drflow-ui-card min-h-[22rem] min-w-0 overflow-visible">
          <div className="drflow-ui-card-header px-5 py-4">
            <SkeletonLine title className="!mb-0" />
          </div>
          <div className="drflow-card-body drflow-ui-card-body p-5">
            <SkeletonLine className="!mb-0 !h-32 !w-full rounded-xl" />
          </div>
        </div>
      </div>
      <p className="sr-only">{t.transitionSrOnly}</p>
    </div>
  );
}
