"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { PageMeta } from "@/core/supabase/pagination";

import {
  PamiPlanillaCategorySection,
  PamiPlanillaFieldsSection,
  PamiPlanillaPreviewSection,
} from "@/features/pami/components/pami/pami-planilla-sections";

import { Button } from "@/components/ui/button";
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
  defaultProfessionalId?: string;
  pageMeta?: PageMeta;
  searchQuery?: string;
  buildPageHref?: (page: number) => string;
}

export function PamiPlanillasView({
  patients,
  professionals,
  defaultProfessionalId,
  pageMeta,
  searchQuery = "",
  buildPageHref,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchQuery);
  const planilla = usePamiPlanillas(patients, professionals, defaultProfessionalId);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      router.push(params.toString() ? `/pami/planillas?${params.toString()}` : "/pami/planillas");
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <Input
          label="Buscar paciente PAMI"
          placeholder="Nombre, apellido o DNI…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[240px] flex-1"
        />
        <Button type="submit" size="sm" disabled={pending}>
          Buscar
        </Button>
      </form>

      {pageMeta && pageMeta.totalPages > 1 && buildPageHref && (
        <ListPagination>
          {pageMeta.page > 1 ? (
            <Link href={buildPageHref(pageMeta.page - 1)}>
              <Button type="button" size="sm" variant="outline">
                Anterior
              </Button>
            </Link>
          ) : null}
          <ListPaginationLabel
            current={pageMeta.page}
            totalPages={pageMeta.totalPages}
            suffix={`${pageMeta.total} pacientes PAMI`}
          />
          {pageMeta.page < pageMeta.totalPages ? (
            <Link href={buildPageHref(pageMeta.page + 1)}>
              <Button type="button" size="sm" variant="outline">
                Siguiente
              </Button>
            </Link>
          ) : null}
        </ListPagination>
      )}

      <PamiPlanillaCategorySection category={planilla.category} selectCategory={planilla.selectCategory} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PamiPlanillaFieldsSection
          patients={patients}
          professionals={professionals}
          remotePatientSearch
          {...planilla}
        />
        <PamiPlanillaPreviewSection {...planilla} />
      </div>
    </div>
  );
}
