"use client";

import { Plus, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { cn } from "@/shared/utils/cn";

import {
  listMedicalOrdersAction,
  searchPatientsForMedicalOrder,
} from "@/features/ordenes-medicas/actions/medical-orders-v2";
import {
  MedicalOrderDetail,
  type MedicalOrderPermissions,
} from "@/features/ordenes-medicas/components/medical-order-detail";
import { MedicalOrderForm } from "@/features/ordenes-medicas/components/medical-order-form";
import { MedicalOrderStatusBadge } from "@/features/ordenes-medicas/components/medical-order-status-badge";
import { moCard, moElevated, moMuted, moText } from "@/features/ordenes-medicas/components/ui-tokens";
import {
  MEDICAL_ORDER_CATEGORIES,
  MEDICAL_ORDER_CATEGORY_LABELS,
  MEDICAL_ORDER_STATUS_LABELS,
  type MedicalOrderCategory,
  type MedicalOrderStatusV2,
} from "@/features/ordenes-medicas/constants";
import type { MedicalOrderDetail as Detail, MedicalOrderListRow } from "@/features/ordenes-medicas/types";
import { categoryLabel, formatDateAr } from "@/features/ordenes-medicas/utils/medical-order-format";
import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";

import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const MEDICAL_ORDERS_CHANGED_EVENT = "medical-orders:changed";

export function notifyMedicalOrdersChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MEDICAL_ORDERS_CHANGED_EVENT));
}

type Props = {
  permissions: MedicalOrderPermissions;
  /** Patient history mode (hides patient column, creates orders for this patient). */
  patientId?: string;
  patientLabel?: string;
  /** Opens the new-order form via URL-driven sheet instead of the inline overlay. */
  newOrderHref?: string;
};

type Filters = {
  q: string;
  category: MedicalOrderCategory | "";
  status: MedicalOrderStatusV2 | "";
  professionalId: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: Filters = { q: "", category: "", status: "", professionalId: "", from: "", to: "" };

function PatientPicker({ onPick }: { onPick: (p: { id: string; name: string }) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; document: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => {
      void searchPatientsForMedicalOrder(term).then((res) => {
        if (res.ok) {
          setResults(res.data);
          setError(null);
        } else setError(res.error);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-3">
      <Input
        label="Buscar paciente (apellido, nombre o DNI)"
        value={q}
        autoFocus
        onChange={(e) => setQ(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-1">
        {(q.trim().length >= 2 ? results : []).map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className={cn(moCard, "w-full px-3 py-2 text-left text-sm hover:border-[var(--primary)]", moText)}
            >
              {p.name}
              {p.document ? <span className={cn("ml-2 text-xs", moMuted)}>DNI {p.document}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      {q.trim().length >= 2 && results.length === 0 ? (
        <p className={cn("text-sm", moMuted)}>Sin resultados.</p>
      ) : null}
    </div>
  );
}

export function MedicalOrdersBrowser({ permissions, patientId, patientLabel, newOrderHref }: Props) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedQ, setAppliedQ] = useState("");
  const [rows, setRows] = useState<MedicalOrderListRow[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Detail | null>(null);
  const [creatingFor, setCreatingFor] = useState<{ id: string; name: string } | null>(null);
  const [pickingPatient, setPickingPatient] = useState(false);
  const [professionalOptions, setProfessionalOptions] = useState<{ value: string; label: string }[]>([]);

  const reload = useCallback(() => {
    startTransition(async () => {
      const res = await listMedicalOrdersAction({
        patientId,
        q: appliedQ || undefined,
        category: filters.category || undefined,
        status: filters.status || undefined,
        professionalId: filters.professionalId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      setLoaded(true);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setRows(res.data.rows);
      setSchemaReady(res.data.schemaReady);
      setProfessionalOptions((prev) => {
        const map = new Map(prev.map((o) => [o.value, o.label]));
        for (const r of res.data.rows) {
          if (r.professional_name && !map.has(r.professional_id)) map.set(r.professional_id, r.professional_name);
        }
        return [...map.entries()].map(([value, label]) => ({ value, label }));
      });
    });
  }, [appliedQ, filters.category, filters.from, filters.professionalId, filters.status, filters.to, patientId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    window.addEventListener(MEDICAL_ORDERS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(MEDICAL_ORDERS_CHANGED_EVENT, reload);
  }, [reload]);

  const hasFilters = useMemo(
    () => Object.entries(filters).some(([, v]) => v !== "") || appliedQ !== "",
    [appliedQ, filters]
  );

  function startNewOrder() {
    if (patientId) setCreatingFor({ id: patientId, name: patientLabel ?? "Paciente" });
    else setPickingPatient(true);
  }

  function closeForm() {
    setCreatingFor(null);
    setEditingDraft(null);
  }

  const formPatientId = editingDraft?.patient_id ?? creatingFor?.id ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedQ(filters.q.trim());
          }}
        >
          <Search className={cn("pointer-events-none absolute left-3 top-3 h-4 w-4", moMuted)} aria-hidden />
          <Input
            aria-label="Buscar órdenes"
            placeholder={patientId ? "Buscar por N.º, estudio o diagnóstico…" : "Buscar por N.º, paciente, DNI o estudio…"}
            value={filters.q}
            className="pl-9"
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </form>
        <div className="w-44">
          <Select
            aria-label="Tipo"
            value={filters.category}
            placeholder="Todos los tipos"
            options={MEDICAL_ORDER_CATEGORIES.map((c) => ({ value: c, label: MEDICAL_ORDER_CATEGORY_LABELS[c] }))}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value as Filters["category"] }))}
          />
        </div>
        <div className="w-36">
          <Select
            aria-label="Estado"
            value={filters.status}
            placeholder="Todos los estados"
            options={(Object.keys(MEDICAL_ORDER_STATUS_LABELS) as MedicalOrderStatusV2[]).map((s) => ({
              value: s,
              label: MEDICAL_ORDER_STATUS_LABELS[s],
            }))}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as Filters["status"] }))}
          />
        </div>
        {professionalOptions.length > 0 ? (
          <div className="w-44">
            <Select
              aria-label="Profesional"
              value={filters.professionalId}
              placeholder="Todos los profesionales"
              options={professionalOptions}
              onChange={(e) => setFilters((f) => ({ ...f, professionalId: e.target.value }))}
            />
          </div>
        ) : null}
        <div className="w-36">
          <Input
            aria-label="Desde"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div className="w-36">
          <Input
            aria-label="Hasta"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setAppliedQ("");
            }}
          >
            <RotateCcw className="h-4 w-4" /> Limpiar
          </Button>
        ) : null}
        {permissions.canIssue ? (
          newOrderHref ? (
            <ButtonLink href={newOrderHref} size="sm">
              <Plus className="h-4 w-4" /> Nueva orden médica
            </ButtonLink>
          ) : (
            <Button size="sm" onClick={startNewOrder} disabled={!schemaReady}>
              <Plus className="h-4 w-4" /> Nueva orden médica
            </Button>
          )
        ) : null}
      </div>

      {!schemaReady ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          El módulo nuevo de órdenes médicas todavía no está habilitado en este entorno. Se muestran las órdenes existentes.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className={cn(moCard, "overflow-x-auto")}>
        <table className="min-w-full text-left text-sm">
          <thead className={moElevated}>
            <tr className="border-b border-[var(--border)]">
              <th className={cn("px-3 py-2 font-semibold", moText)}>N.º / fecha</th>
              {!patientId ? <th className={cn("px-3 py-2 font-semibold", moText)}>Paciente</th> : null}
              <th className={cn("px-3 py-2 font-semibold", moText)}>Tipo</th>
              <th className={cn("px-3 py-2 font-semibold", moText)}>Solicitud</th>
              <th className={cn("px-3 py-2 font-semibold", moText)}>Profesional</th>
              <th className={cn("px-3 py-2 font-semibold", moText)}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => setOpenOrderId(r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setOpenOrderId(r.id);
                }}
                className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--table-hover,var(--surface-hover,var(--muted)))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <td className={cn("whitespace-nowrap px-3 py-2", moText)}>
                  <span className="font-medium">{r.order_number ?? (r.status === "draft" ? "Borrador" : "—")}</span>
                  <span className={cn("block text-xs", moMuted)}>{formatDateAr(r.issued_at ?? r.created_at)}</span>
                </td>
                {!patientId ? (
                  <td className={cn("px-3 py-2", moText)}>
                    <Link
                      href={`/pacientes/${r.patient_id}?tab=ordenes`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {r.patient_name ?? "—"}
                    </Link>
                    {r.patient_document ? <span className={cn("block text-xs", moMuted)}>DNI {r.patient_document}</span> : null}
                  </td>
                ) : null}
                <td className={cn("px-3 py-2", moText)}>{categoryLabel(r.order_category)}</td>
                <td className={cn("max-w-xs px-3 py-2", moText)}>
                  <span className="line-clamp-2">{r.order_text.replace(/^[^\n]*\n/, "").replace(/^- /gm, "") || r.order_text}</span>
                </td>
                <td className={cn("px-3 py-2", moText)}>{r.professional_name ?? "—"}</td>
                <td className="px-3 py-2">
                  <MedicalOrderStatusBadge status={r.status} />
                  {r.priority === "urgente" ? <span className="ml-1 text-xs font-semibold text-red-600">Urgente</span> : null}
                </td>
              </tr>
            ))}
            {loaded && rows.length === 0 ? (
              <tr>
                <td colSpan={patientId ? 5 : 6} className={cn("px-3 py-6 text-center text-sm", moMuted)}>
                  {hasFilters ? "No hay órdenes que coincidan con los filtros." : "Sin órdenes médicas."}
                </td>
              </tr>
            ) : null}
            {!loaded || pending ? (
              <tr>
                <td colSpan={patientId ? 5 : 6} className={cn("px-3 py-3 text-center text-xs", moMuted)}>
                  Cargando…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PatientWorkspaceOverlay
        open={Boolean(openOrderId) && !editingDraft}
        title="Orden médica"
        onClose={() => setOpenOrderId(null)}
        wide
      >
        {openOrderId ? (
          <MedicalOrderDetail
            key={openOrderId}
            orderId={openOrderId}
            permissions={permissions}
            onChanged={() => {
              reload();
            }}
            onEditDraft={(d) => {
              setEditingDraft(d);
              setOpenOrderId(null);
            }}
          />
        ) : null}
      </PatientWorkspaceOverlay>

      <PatientWorkspaceOverlay
        open={pickingPatient}
        title="Nueva orden médica"
        subtitle="Elegí el paciente"
        onClose={() => setPickingPatient(false)}
      >
        <PatientPicker
          onPick={(p) => {
            setPickingPatient(false);
            setCreatingFor(p);
          }}
        />
      </PatientWorkspaceOverlay>

      <PatientWorkspaceOverlay
        open={Boolean(formPatientId)}
        title={editingDraft ? "Editar borrador" : "Nueva orden médica"}
        subtitle={editingDraft?.patient_name ?? creatingFor?.name}
        onClose={closeForm}
        wide
      >
        {formPatientId ? (
          <MedicalOrderForm
            key={editingDraft?.id ?? formPatientId}
            patientId={formPatientId}
            draft={editingDraft}
            onCancel={closeForm}
            onDone={(res) => {
              closeForm();
              reload();
              setOpenOrderId(res.id);
            }}
          />
        ) : null}
      </PatientWorkspaceOverlay>
    </div>
  );
}
