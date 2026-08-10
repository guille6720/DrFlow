"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PageMeta } from "@/core/supabase/pagination";

import { updateWaitingListStatus } from "@/features/turnos/actions/waiting-list";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPagination, ListPaginationLabel } from "@/components/ui/list-pagination";

export type WaitingListRow = {
  id: string;
  status: string;
  notes: string | null;
  consultation_modality: string;
  preferred_date_from: string | null;
  preferred_date_to: string | null;
  preferred_time_from: string | null;
  preferred_time_to: string | null;
  created_at: string;
  patients: { first_name: string; last_name: string; document_number: string; phone: string | null } | null;
  professionals: { display_name: string | null; profiles: { full_name: string | null } | null } | null;
  specialties: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  contacted: "Contactado",
  scheduled: "Agendado",
  cancelled: "Cancelado",
};

type Props = {
  entries: WaitingListRow[];
  pageMeta?: PageMeta;
  searchQuery?: string;
  buildPageHref?: (page: number) => string;
};

export function WaitingListView({
  entries,
  pageMeta,
  searchQuery = "",
  buildPageHref,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(searchQuery);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleStatus(id: string, status: "contacted" | "scheduled" | "cancelled") {
    setUpdatingId(id);
    await updateWaitingListStatus(id, status);
    setUpdatingId(null);
    router.refresh();
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    const term = q.trim();
    if (term) params.set("q", term);
    const qs = params.toString();
    router.push(qs ? `/turnos/lista-espera?${qs}` : "/turnos/lista-espera");
  }

  const { page = 1, totalPages = 1, total = entries.length } = pageMeta ?? {};
  const hasPagination = Boolean(buildPageHref && pageMeta && totalPages > 1);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Lista de espera</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Pacientes esperando un turno compatible. Cuando se libera un horario, contactalos desde acá.
        </p>
      </div>

      <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
        <Input
          label="Buscar paciente"
          placeholder="Nombre, apellido o DNI"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[240px] flex-1"
          type="search"
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" className="self-end">
          Buscar
        </Button>
      </form>

      {pageMeta ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          {total} en lista · mostrando {entries.length} fila(s) en esta página
          {searchQuery ? (
            <>
              {" "}
              · filtro: <span className="font-medium">{searchQuery}</span>
            </>
          ) : null}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">
            {searchQuery ? "No hay coincidencias en la lista de espera." : "No hay pacientes en lista de espera."}
          </p>
        </Card>
      ) : (
        entries.map((entry) => {
          const patient = entry.patients;
          const professional = entry.professionals;
          const profName =
            professional?.display_name ??
            (professional?.profiles as { full_name?: string } | null)?.full_name ??
            "Cualquier profesional";
          const busy = updatingId === entry.id;

          return (
            <Card key={entry.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">
                    {patient ? `${patient.last_name}, ${patient.first_name}` : "Paciente"}
                    {patient?.document_number ? ` · DNI ${patient.document_number}` : ""}
                  </p>
                  <p className="text-[var(--muted-foreground)]">
                    {entry.specialties?.name ?? "Sin especialidad"} · {profName}
                  </p>
                  <p>
                    Preferencia:{" "}
                    {entry.preferred_date_from
                      ? format(new Date(entry.preferred_date_from), "d MMM yyyy", { locale: es })
                      : "Flexible"}
                    {entry.preferred_date_to
                      ? ` — ${format(new Date(entry.preferred_date_to), "d MMM yyyy", { locale: es })}`
                      : ""}
                    {entry.preferred_time_from ? ` · desde ${entry.preferred_time_from.slice(0, 5)}` : ""}
                    {entry.preferred_time_to ? ` hasta ${entry.preferred_time_to.slice(0, 5)}` : ""}
                  </p>
                  <p>
                    Modalidad: {entry.consultation_modality === "virtual" ? "Virtual" : "Presencial"} ·{" "}
                    <span className="font-medium">{STATUS_LABEL[entry.status] ?? entry.status}</span>
                  </p>
                  {entry.notes ? <p className="text-[var(--muted-foreground)]">{entry.notes}</p> : null}
                  {patient?.phone ? (
                    <a
                      href={`https://wa.me/${patient.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-[var(--primary)] hover:underline"
                    >
                      Contactar por WhatsApp
                    </a>
                  ) : null}
                </div>
                {entry.status === "active" || entry.status === "contacted" ? (
                  <div className="flex flex-wrap gap-2">
                    {entry.status === "active" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={busy}
                        onClick={() => void handleStatus(entry.id, "contacted")}
                      >
                        Marcar contactado
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      loading={busy}
                      onClick={() => void handleStatus(entry.id, "scheduled")}
                    >
                      Turno agendado
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={busy}
                      disabled={busy}
                      onClick={() => void handleStatus(entry.id, "cancelled")}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })
      )}

      {hasPagination && buildPageHref ? (
        <ListPagination>
          {page > 1 ? (
            <Link href={buildPageHref(page - 1)}>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
            </Link>
          ) : null}
          <ListPaginationLabel
            current={page}
            totalPages={totalPages}
            suffix={`${total} en lista`}
          />
          {page < totalPages ? (
            <Link href={buildPageHref(page + 1)}>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : null}
        </ListPagination>
      ) : null}
    </div>
  );
}
