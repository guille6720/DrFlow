"use client";

import { AlertTriangle, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { toast } from "@/core/notifications/toast";

import { cn } from "@/shared/utils/cn";

import {
  createMedicalOrderV2,
  getMedicalOrderFormContext,
  type MedicalOrderFormContext,
  updateMedicalOrderDraft,
} from "@/features/ordenes-medicas/actions/medical-orders-v2";
import { moCard, moChip, moChipActive, moElevated, moMuted, moText } from "@/features/ordenes-medicas/components/ui-tokens";
import {
  IMAGING_CONTRAST_LABELS,
  IMAGING_CONTRAST_OPTIONS,
  type ImagingContrast,
  MEDICAL_ORDER_CATEGORIES,
  MEDICAL_ORDER_CATEGORY_LABELS,
  MEDICAL_ORDER_DEFAULT_VALIDITY_DAYS,
  MEDICAL_ORDER_PRIORITIES,
  MEDICAL_ORDER_PRIORITY_LABELS,
  type MedicalOrderCategory,
  type MedicalOrderPriority,
  type MedicalOrderStatusV2,
} from "@/features/ordenes-medicas/constants";
import type { MedicalOrderCatalogEntry, MedicalOrderDetail } from "@/features/ordenes-medicas/types";
import { computeAge, formatDateAr } from "@/features/ordenes-medicas/utils/medical-order-format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type DraftItem = {
  key: string;
  code: string | null;
  name: string;
  description: string;
  body_region: string;
  contrast: ImagingContrast | "";
  indication: string;
  observations: string;
};

type Props = {
  patientId: string;
  clinicalRecordId?: string | null;
  draft?: MedicalOrderDetail | null;
  onDone: (result: { id: string; status: MedicalOrderStatusV2; order_number: string | null }) => void;
  onCancel: () => void;
};

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function defaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + MEDICAL_ORDER_DEFAULT_VALIDITY_DAYS);
  return d.toISOString().slice(0, 10);
}

function toDraftItem(name: string, code: string | null = null, detail: string | null = null): DraftItem {
  return {
    key: newKey(),
    code,
    name,
    description: detail ?? "",
    body_region: "",
    contrast: "",
    indication: "",
    observations: "",
  };
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function draftItemsFrom(detail: MedicalOrderDetail): DraftItem[] {
  return detail.items.map((i) => ({
    key: newKey(),
    code: i.code,
    name: i.name,
    description: i.description ?? "",
    body_region: typeof i.metadata?.body_region === "string" ? i.metadata.body_region : "",
    contrast: (typeof i.metadata?.contrast === "string" ? i.metadata.contrast : "") as ImagingContrast | "",
    indication: typeof i.metadata?.indication === "string" ? i.metadata.indication : "",
    observations: typeof i.metadata?.observations === "string" ? i.metadata.observations : "",
  }));
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className={cn("text-[11px] uppercase tracking-wide", moMuted)}>{label}</dt>
      <dd className={cn("truncate text-sm font-medium", moText)}>{value?.trim() || "—"}</dd>
    </div>
  );
}

export function MedicalOrderForm({ patientId, clinicalRecordId, draft, onDone, onCancel }: Props) {
  const [ctx, setCtx] = useState<MedicalOrderFormContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<MedicalOrderCategory>(draft?.order_category ?? "laboratorio");
  const [items, setItems] = useState<DraftItem[]>(() => (draft ? draftItemsFrom(draft) : []));
  const [search, setSearch] = useState("");
  const [diagnosisText, setDiagnosisText] = useState(draft?.diagnosis_text ?? "");
  const [diagnosisCode, setDiagnosisCode] = useState(draft?.diagnosis_code ?? "");
  const [indication, setIndication] = useState(draft?.clinical_indication ?? "");
  const [preparation, setPreparation] = useState(draft?.preparation_instructions ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [priority, setPriority] = useState<MedicalOrderPriority>(draft?.priority ?? "normal");
  const [validUntil, setValidUntil] = useState(draft?.valid_until ?? defaultValidUntil());
  const [idempotencyKey] = useState(newKey);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingMode, setPendingMode] = useState<"draft" | "issue" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMedicalOrderFormContext(patientId).then((res) => {
      if (cancelled) return;
      if (res.ok) setCtx(res.data);
      else setLoadError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const catalogForCategory = useMemo(
    () => (ctx?.catalog ?? []).filter((c) => c.order_category === category),
    [ctx, category]
  );

  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, typeof catalogForCategory>();
    for (const entry of catalogForCategory) {
      const g = entry.group_label ?? "General";
      groups.set(g, [...(groups.get(g) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [catalogForCategory]);

  const suggestions = useMemo(() => {
    const tokens = normalizeSearch(search).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    return (ctx?.catalog ?? [])
      .filter((c) => {
        if (c.order_category !== category) return false;
        const name = normalizeSearch(c.name);
        const haystack = `${name} ${normalizeSearch(c.group_label ?? "")} ${normalizeSearch(c.detail ?? "")}`;
        return tokens.every((t) => haystack.includes(t));
      })
      .sort((a, b) => Number(normalizeSearch(b.name).includes(tokens[0])) - Number(normalizeSearch(a.name).includes(tokens[0])))
      .slice(0, 8);
  }, [ctx, category, search]);

  const selectedNames = new Set(items.map((i) => i.name.toLowerCase()));

  function toggleCatalog(entry: Pick<MedicalOrderCatalogEntry, "name" | "code" | "detail">) {
    const key = entry.name.toLowerCase();
    setItems((prev) =>
      prev.some((i) => i.name.toLowerCase() === key)
        ? prev.filter((i) => i.name.toLowerCase() !== key)
        : [...prev, toDraftItem(entry.name, entry.code, entry.detail)]
    );
  }

  function addFreeText() {
    const name = search.trim();
    if (!name) return;
    if (!selectedNames.has(name.toLowerCase())) setItems((prev) => [...prev, toDraftItem(name)]);
    setSearch("");
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function changeCategory(next: MedicalOrderCategory) {
    if (next === category) return;
    if (items.length > 0 && !window.confirm("Cambiar el tipo de orden quita los estudios seleccionados. ¿Continuar?")) {
      return;
    }
    setCategory(next);
    setItems([]);
    setSearch("");
  }

  function submit(mode: "draft" | "issue") {
    setError(null);
    const payload = {
      patient_id: patientId,
      clinical_record_id: clinicalRecordId ?? draft?.clinical_record_id ?? null,
      category,
      items: items.map((i) => ({
        code: i.code,
        name: i.name,
        description: i.description || null,
        imaging:
          category === "imagenes"
            ? {
                body_region: i.body_region || null,
                contrast: i.contrast || null,
                indication: i.indication || null,
                observations: i.observations || null,
              }
            : null,
      })),
      diagnosis_text: diagnosisText || null,
      diagnosis_code: diagnosisCode || null,
      clinical_indication: indication || null,
      preparation_instructions: preparation || null,
      notes: notes || null,
      priority,
      valid_until: validUntil || null,
      idempotency_key: draft ? null : idempotencyKey,
    };
    setPendingMode(mode);
    startTransition(async () => {
      const res = draft
        ? await updateMedicalOrderDraft(draft.id, payload, mode === "issue")
        : await createMedicalOrderV2(payload, mode);
      setPendingMode(null);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.status === "issued" ? `Orden ${res.data.order_number ?? ""} emitida` : "Borrador guardado"
      );
      onDone(res.data);
    });
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!ctx) return <p className={cn("text-sm", moMuted)}>Cargando datos del paciente…</p>;

  const p = ctx.patient;
  const age = computeAge(p.birth_date);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <section className={cn(moCard, "p-3")}>
          <h3 className={cn("mb-2 text-sm font-semibold", moText)}>Paciente</h3>
          <dl className="grid grid-cols-2 gap-2">
            <InfoRow label="Nombre" value={`${p.last_name}, ${p.first_name}`} />
            <InfoRow label={p.document_type ?? "DNI"} value={p.document_number} />
            <InfoRow label="Nacimiento" value={`${formatDateAr(p.birth_date)}${age != null ? ` · ${age} años` : ""}`} />
            <InfoRow label="Sexo" value={p.sex} />
            <InfoRow label="Obra social" value={p.insurance_provider ?? "Particular"} />
            <InfoRow label="Plan / N.º afiliado" value={[p.insurance_plan, p.insurance_number].filter(Boolean).join(" · ")} />
          </dl>
        </section>
        <section className={cn(moCard, "p-3")}>
          <h3 className={cn("mb-2 text-sm font-semibold", moText)}>Profesional emisor</h3>
          {ctx.professional ? (
            <dl className="grid grid-cols-2 gap-2">
              <InfoRow label="Nombre" value={ctx.professional.name} />
              <InfoRow label="Especialidad" value={ctx.professional.specialty} />
              <InfoRow
                label="Matrícula"
                value={ctx.professional.license ? `${ctx.professional.licenseType ?? ""} ${ctx.professional.license}`.trim() : null}
              />
              <InfoRow label="Consultorio" value={ctx.clinic.name} />
              <InfoRow label="Dirección" value={ctx.clinic.address} />
              <InfoRow label="Contacto" value={ctx.clinic.phone ?? ctx.clinic.email} />
            </dl>
          ) : null}
          {ctx.issueBlockedReason ? (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {ctx.issueBlockedReason}
            </p>
          ) : null}
        </section>
      </div>

      <section>
        <h3 className={cn("mb-2 text-sm font-semibold", moText)}>Tipo de orden</h3>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de orden">
          {MEDICAL_ORDER_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              disabled={Boolean(draft)}
              onClick={() => changeCategory(c)}
              className={cn(moChip, moText, category === c && moChipActive, draft && "cursor-not-allowed opacity-70")}
            >
              {MEDICAL_ORDER_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className={cn("text-sm font-semibold", moText)}>Estudio / práctica solicitada</h3>
        <div className="relative">
          <Search className={cn("pointer-events-none absolute left-3 top-3 h-4 w-4", moMuted)} aria-hidden />
          <Input
            aria-label="Buscar estudio o escribir texto libre"
            placeholder="Buscar en el catálogo o escribir texto libre…"
            value={search}
            className="pl-9"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (suggestions[0] && normalizeSearch(suggestions[0].name) === normalizeSearch(search)) {
                  toggleCatalog(suggestions[0]);
                  setSearch("");
                } else addFreeText();
              }
            }}
          />
          {search.trim() ? (
            <div className={cn(moCard, "absolute z-20 mt-1 w-full overflow-hidden shadow-lg")}>
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={cn("block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover,var(--muted))]", moText)}
                  onClick={() => {
                    if (!selectedNames.has(s.name.toLowerCase())) toggleCatalog(s);
                    setSearch("");
                  }}
                >
                  {s.name}
                  {s.group_label ? <span className={cn("ml-2 text-xs", moMuted)}>{s.group_label}</span> : null}
                </button>
              ))}
              <button
                type="button"
                className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover,var(--muted))]", moText)}
                onClick={addFreeText}
              >
                <Plus className="h-4 w-4" aria-hidden /> Agregar “{search.trim()}” como texto libre
              </button>
            </div>
          ) : null}
        </div>

        {groupedCatalog.length > 0 ? (
          <div className={cn("max-h-64 space-y-3 overflow-y-auto rounded-xl p-3", moElevated)}>
            {groupedCatalog.map(([group, entries]) => (
              <div key={group}>
                <p className={cn("mb-1 text-xs font-semibold uppercase tracking-wide", moMuted)}>{group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {entries.map((e) => {
                    const active = selectedNames.has(e.name.toLowerCase());
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={active}
                        title={e.detail ?? undefined}
                        onClick={() => toggleCatalog(e)}
                        className={cn(moChip, "px-2.5 py-1 text-xs", moText, active && moChipActive)}
                      >
                        {e.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li key={item.key} className={cn(moCard, "p-3")}>
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-sm font-semibold", moText)}>
                    {idx + 1}. {item.name}
                  </p>
                  <button
                    type="button"
                    aria-label={`Quitar ${item.name}`}
                    onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                    className={cn("rounded p-1 hover:bg-[var(--surface-hover,var(--muted))]", moMuted)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {category === "imagenes" ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input
                      label="Región del cuerpo"
                      value={item.body_region}
                      onChange={(e) => updateItem(item.key, { body_region: e.target.value })}
                    />
                    <Select
                      label="Contraste"
                      value={item.contrast}
                      placeholder="Seleccionar…"
                      options={IMAGING_CONTRAST_OPTIONS.map((o) => ({ value: o, label: IMAGING_CONTRAST_LABELS[o] }))}
                      onChange={(e) => updateItem(item.key, { contrast: e.target.value as ImagingContrast | "" })}
                    />
                    <Input
                      label="Indicación"
                      value={item.indication}
                      onChange={(e) => updateItem(item.key, { indication: e.target.value })}
                    />
                    <Input
                      label="Observaciones"
                      value={item.observations}
                      onChange={(e) => updateItem(item.key, { observations: e.target.value })}
                    />
                  </div>
                ) : (
                  <Input
                    aria-label={`Detalle de ${item.name}`}
                    placeholder="Detalle opcional (determinaciones, cantidad de sesiones, etc.)"
                    value={item.description}
                    className="mt-2"
                    onChange={(e) => updateItem(item.key, { description: e.target.value })}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn("text-sm", moMuted)}>Seleccioná estudios del catálogo o escribí uno como texto libre.</p>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-[1fr_160px]">
        <div className="space-y-1">
          {ctx.diagnoses.length > 0 ? (
            <Select
              label="Diagnóstico de la historia clínica"
              value=""
              placeholder="Elegir de la HC…"
              options={ctx.diagnoses.map((d, i) => ({
                value: String(i),
                label: d.cie10_code ? `${d.name} (${d.cie10_code})` : d.name,
              }))}
              onChange={(e) => {
                const d = ctx.diagnoses[Number(e.target.value)];
                if (d) {
                  setDiagnosisText(d.name);
                  setDiagnosisCode(d.cie10_code ?? "");
                }
              }}
            />
          ) : null}
          <Input
            label="Diagnóstico / presunción diagnóstica"
            value={diagnosisText}
            maxLength={500}
            onChange={(e) => setDiagnosisText(e.target.value)}
          />
        </div>
        <Input
          label="CIE-10"
          value={diagnosisCode}
          maxLength={20}
          className="self-end"
          onChange={(e) => setDiagnosisCode(e.target.value.toUpperCase())}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Textarea
          label="Indicación clínica"
          value={indication}
          maxLength={2000}
          rows={3}
          onChange={(e) => setIndication(e.target.value)}
        />
        <Textarea
          label="Preparación / instrucciones para el paciente"
          value={preparation}
          maxLength={2000}
          rows={3}
          onChange={(e) => setPreparation(e.target.value)}
        />
        <Textarea
          label="Observaciones"
          value={notes}
          maxLength={2000}
          rows={2}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="space-y-3">
          <fieldset>
            <legend className="drflow-ui-label mb-1 block text-sm font-medium">Prioridad</legend>
            <div className="flex flex-wrap gap-2">
              {MEDICAL_ORDER_PRIORITIES.map((pr) => (
                <button
                  key={pr}
                  type="button"
                  aria-pressed={priority === pr}
                  onClick={() => setPriority(pr)}
                  className={cn(
                    moChip,
                    moText,
                    priority === pr && (pr === "urgente" ? "border-red-600 bg-red-600 text-white" : moChipActive)
                  )}
                >
                  {MEDICAL_ORDER_PRIORITY_LABELS[pr]}
                </button>
              ))}
            </div>
          </fieldset>
          <Input
            label="Válida hasta"
            type="date"
            value={validUntil}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className={cn("sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-3", "bg-[var(--surface-card,var(--card))]")}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => submit("draft")}
          loading={pending && pendingMode === "draft"}
          disabled={pending || items.length === 0 || !ctx.canIssue}
        >
          Guardar borrador
        </Button>
        <Button
          type="button"
          onClick={() => submit("issue")}
          loading={pending && pendingMode === "issue"}
          pendingLabel="Emitiendo…"
          disabled={pending || items.length === 0 || !ctx.canIssue}
        >
          Emitir orden
        </Button>
      </div>
    </div>
  );
}
