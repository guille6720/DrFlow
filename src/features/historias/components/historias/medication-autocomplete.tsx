"use client";

import { Clock, Loader2, Search, Star, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { FloatingAnchorPanel } from "@/core/components/ui/floating-anchor-panel";

import { cn } from "@/shared/utils/cn";

import { searchClinicalTreatments } from "@/features/historias/actions/clinical-treatments";
import { useClinicalFavoritesOptional } from "@/features/historias/components/historias/clinical-favorites-provider";
import { ClinicalFavoritesQuickList } from "@/features/historias/components/historias/clinical-favorites-quick-list";
import { ClinicalRecentUsageQuickList } from "@/features/historias/components/historias/clinical-recent-usage-quick-list";
import { FavoriteStarButton } from "@/features/historias/components/historias/favorite-star-button";
import {
  type ClinicalFavoriteMedicationPayload,
  type ClinicalFavoriteRow,
  medicationFavoriteFingerprint,
} from "@/features/historias/types/clinical-favorites";
import type { ClinicalRecentUsageRow } from "@/features/historias/types/clinical-recent-usage";
import type { ClinicalTreatmentCatalogHit } from "@/features/historias/types/clinical-treatment-catalog";
import { CLINICAL_TREATMENT_KIND_LABELS } from "@/features/historias/types/clinical-treatment-catalog";
import {
  catalogToMedicationSelection,
  formatVademecumPrescriptionSubtitle,
  parsePharmaceuticalFormFromPresentation,
} from "@/features/recetas/components/recetas/vademecum-to-prescription";
import { formatPrescriptionMedicationLabel } from "@/features/recetas/utils/format-prescription-medication-label";
import { medicationCatalogSearchLabel } from "@/features/recetas/utils/medication-catalog-utils";

import { Button } from "@/components/ui/button";
import type { MedicationCatalogResult } from "@/types/pharmacology";
import type { PrescriptionMedication } from "@/types/prescription";

const MIN_QUERY_LENGTH = 2;

type Props = {
  medications: PrescriptionMedication[];
  onMedicationsChange: (medications: PrescriptionMedication[]) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
  highlighted?: boolean;
  label?: string;
  placeholder?: string;
};

function catalogHitConcentration(item: MedicationCatalogResult): string {
  const match = item.presentation.match(/\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|%|ui|u\.?i\.?)/i);
  return match?.[0]?.replace(/\s+/g, " ") ?? "";
}

function catalogHitMeta(item: MedicationCatalogResult): string {
  const concentration = catalogHitConcentration(item);
  const form = parsePharmaceuticalFormFromPresentation(item.presentation);
  return [
    item.presentation.trim() || null,
    concentration ? `Conc.: ${concentration}` : null,
    form ? `Forma: ${form}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function medicationIdentityKey(
  med: Pick<PrescriptionMedication, "generic_name" | "brand_name" | "presentation" | "vademecum_code">
): string {
  if (med.vademecum_code?.trim()) return `code:${med.vademecum_code.trim().toLowerCase()}`;
  return [
    med.generic_name.trim().toLowerCase(),
    (med.brand_name ?? "").trim().toLowerCase(),
    (med.presentation ?? "").trim().toLowerCase(),
  ].join("|");
}

function payloadFromFavorite(fav: ClinicalFavoriteRow): ClinicalFavoriteMedicationPayload {
  const raw = fav.payload as ClinicalFavoriteMedicationPayload;
  return {
    generic_name: raw.generic_name?.trim() || fav.label,
    brand_name: raw.brand_name ?? "",
    presentation: raw.presentation ?? "",
    concentration: raw.concentration ?? "",
    pharmaceutical_form: raw.pharmaceutical_form ?? "",
    vademecum_code: raw.vademecum_code ?? null,
    active_ingredient: raw.active_ingredient ?? raw.generic_name ?? fav.label,
  };
}

function payloadFromRecent(row: ClinicalRecentUsageRow): ClinicalFavoriteMedicationPayload {
  const raw = row.payload as ClinicalFavoriteMedicationPayload;
  return {
    generic_name: raw.generic_name?.trim() || row.label,
    brand_name: raw.brand_name ?? "",
    presentation: raw.presentation ?? "",
    concentration: raw.concentration ?? "",
    pharmaceutical_form: raw.pharmaceutical_form ?? "",
    vademecum_code: raw.vademecum_code ?? null,
    active_ingredient: raw.active_ingredient ?? raw.generic_name ?? row.label,
  };
}

function payloadFromMed(med: PrescriptionMedication): ClinicalFavoriteMedicationPayload {
  return {
    generic_name: med.generic_name,
    brand_name: med.brand_name ?? "",
    presentation: med.presentation ?? "",
    concentration: med.concentration ?? "",
    pharmaceutical_form: med.pharmaceutical_form ?? "",
    vademecum_code: med.vademecum_code ?? null,
    active_ingredient: med.active_ingredient ?? med.generic_name,
  };
}

function favoriteToMedication(payload: ClinicalFavoriteMedicationPayload): PrescriptionMedication {
  return {
    generic_name: payload.generic_name,
    active_ingredient: payload.active_ingredient ?? payload.generic_name,
    brand_name: payload.brand_name ?? "",
    presentation: payload.presentation ?? "",
    concentration: payload.concentration ?? "",
    pharmaceutical_form: payload.pharmaceutical_form ?? "",
    quantity: 0,
    posology: "",
    dose: "",
    frequency: "",
    route: "",
    instructions: "",
    vademecum_code: payload.vademecum_code ?? undefined,
    search_source: payload.vademecum_code ? "catalog" : "manual",
  };
}

type ListItem =
  | { source: "favorite"; key: string; payload: ClinicalFavoriteMedicationPayload }
  | { source: "recent"; key: string; payload: ClinicalFavoriteMedicationPayload }
  | { source: "separator"; key: string }
  | { source: "catalog"; key: string; item: MedicationCatalogResult }
  | { source: "clinical"; key: string; item: ClinicalTreatmentCatalogHit };

function clinicalToMedication(item: ClinicalTreatmentCatalogHit): PrescriptionMedication {
  return {
    generic_name: item.name,
    active_ingredient: item.name,
    brand_name: "",
    presentation: "",
    concentration: "",
    pharmaceutical_form: "",
    quantity: 0,
    posology: "",
    dose: "",
    frequency: "",
    route: "",
    instructions: "",
    search_source: "manual",
  };
}

export function MedicationAutocomplete({
  medications,
  onMedicationsChange,
  searchInputRef,
  className,
  highlighted = false,
  label = "Medicación",
  placeholder = "Buscar medicamento…",
}: Props) {
  const listId = useId();
  const internalSearchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listPanelRef = useRef<HTMLDivElement>(null);
  const favorites = useClinicalFavoritesOptional();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MedicationCatalogResult[]>([]);
  const [clinicalResults, setClinicalResults] = useState<ClinicalTreatmentCatalogHit[]>([]);
  const [catalogEmpty, setCatalogEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const panelOpen = open && query.trim().length >= MIN_QUERY_LENGTH;

  const existingKeys = new Set(medications.map(medicationIdentityKey));
  const allMedicationFavorites = favorites?.byKind("medication") ?? [];
  const allMedicationRecent = favorites?.recentByKind("medication") ?? [];

  const listItems = useMemo<ListItem[]>(() => {
    const matchingFavorites = favorites?.matchingFavorites("medication", query) ?? [];
    const matchingRecent = favorites?.matchingRecent("medication", query) ?? [];
    const favoriteItems: ListItem[] = matchingFavorites.map((favorite) => ({
      source: "favorite",
      key: `fav:${favorite.id}`,
      payload: payloadFromFavorite(favorite),
    }));
    const seen = new Set(
      favoriteItems.map((item) =>
        item.source === "favorite" ? medicationFavoriteFingerprint(item.payload) : ""
      )
    );

    const recentItems: ListItem[] = [];
    for (const row of matchingRecent) {
      const payload = payloadFromRecent(row);
      const fp = medicationFavoriteFingerprint(payload);
      if (seen.has(fp)) continue;
      seen.add(fp);
      recentItems.push({ source: "recent", key: `rec:${row.id}`, payload });
    }

    const catalogItems: ListItem[] = results
      .filter((item) => {
        const draft = catalogToMedicationSelection(item);
        const fp = medicationFavoriteFingerprint({
          generic_name: draft.generic_name,
          brand_name: draft.brand_name,
          presentation: draft.presentation,
          vademecum_code: draft.vademecum_code,
        });
        return !seen.has(fp);
      })
      .map((item) => ({ source: "catalog" as const, key: `cat:${item.id}`, item }));

    for (const item of catalogItems) {
      if (item.source === "catalog") {
        seen.add(
          medicationFavoriteFingerprint({
            generic_name: catalogToMedicationSelection(item.item).generic_name,
            brand_name: catalogToMedicationSelection(item.item).brand_name,
            presentation: catalogToMedicationSelection(item.item).presentation,
            vademecum_code: catalogToMedicationSelection(item.item).vademecum_code,
          })
        );
      }
    }

    const clinicalItems: ListItem[] = clinicalResults
      .filter((item) => {
        const draft = clinicalToMedication(item);
        return !seen.has(medicationFavoriteFingerprint(payloadFromMed(draft)));
      })
      .map((item) => ({ source: "clinical" as const, key: `clin:${item.id}`, item }));

    const remoteItems = [...catalogItems, ...clinicalItems];
    const prioritized = [...favoriteItems, ...recentItems];
    if (prioritized.length > 0 && remoteItems.length > 0) {
      return [...prioritized, { source: "separator", key: "sep" }, ...remoteItems];
    }
    return [...prioritized, ...remoteItems];
  }, [clinicalResults, favorites, query, results]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setClinicalResults([]);
      setCatalogEmpty(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: "24" });
      const response = await fetch(`/api/medications/search?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: MedicationCatalogResult[];
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "No se pudo buscar el vademécum.");
        setResults([]);
        setClinicalResults([]);
        setCatalogEmpty(false);
        return;
      }

      const meds = payload?.data ?? [];
      setResults(meds);
      setCatalogEmpty(meds.length === 0);

      if (meds.length === 0) {
        const clinical = await searchClinicalTreatments(q, { limit: 12, kind: "pharmacologic" });
        setClinicalResults(clinical.data ?? []);
        if (clinical.error && !meds.length) {
          setError(clinical.error);
        }
      } else {
        setClinicalResults([]);
      }

      setHighlight(0);
    } catch {
      setError("No se pudo buscar el vademécum.");
      setResults([]);
      setClinicalResults([]);
      setCatalogEmpty(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void search(query), 280);
    return () => window.clearTimeout(timer);
  }, [query, open, search]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listPanelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function assignSearchRef(node: HTMLInputElement | null) {
    internalSearchRef.current = node;
    if (searchInputRef) searchInputRef.current = node;
  }

  function updateMed(index: number, patch: Partial<PrescriptionMedication>) {
    const next = [...medications];
    next[index] = { ...medications[index], ...patch };
    onMedicationsChange(next);
  }

  function addMedication(med: PrescriptionMedication) {
    const key = medicationIdentityKey(med);
    if (!existingKeys.has(key)) {
      onMedicationsChange([...medications, med]);
    }
    void favorites?.rememberMedicationUsage(payloadFromMed(med));
    setQuery("");
    setResults([]);
    setClinicalResults([]);
    setOpen(false);
    internalSearchRef.current?.focus();
  }

  function handleSelect(item: MedicationCatalogResult) {
    addMedication(catalogToMedicationSelection(item));
  }

  function handleSelectClinical(item: ClinicalTreatmentCatalogHit) {
    addMedication(clinicalToMedication(item));
  }

  function handleSelectFavorite(payload: ClinicalFavoriteMedicationPayload) {
    addMedication(favoriteToMedication(payload));
  }

  function handleAddManual() {
    const name = query.trim();
    if (!name) return;
    addMedication({
      generic_name: name,
      active_ingredient: name,
      brand_name: "",
      presentation: "",
      concentration: "",
      pharmaceutical_form: "",
      quantity: 0,
      posology: "",
      dose: "",
      frequency: "",
      route: "",
      instructions: "",
      search_source: "manual",
    });
  }

  function handleRemove(index: number) {
    onMedicationsChange(medications.filter((_, i) => i !== index));
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && listItems.length === 0 && query.trim()) {
      event.preventDefault();
      handleAddManual();
      return;
    }
    if (!open || listItems.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, listItems.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = listItems[highlight];
      if (item?.source === "favorite" || item?.source === "recent") handleSelectFavorite(item.payload);
      else if (item?.source === "catalog") handleSelect(item.item);
      else if (item?.source === "clinical") handleSelectClinical(item.item);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div ref={containerRef} className="relative">
        <label htmlFor={listId} className="mb-1.5 block text-sm font-medium drflow-ehr-label">
          {label}
        </label>
        <div ref={anchorRef} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={assignSearchRef}
            id={listId}
            type="text"
            role="combobox"
            aria-expanded={panelOpen}
            aria-autocomplete="list"
            aria-controls={`${listId}-listbox`}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleSearchKeyDown}
            className={cn(
              "drflow-clinical-combobox-input py-2.5 pl-10 pr-10 focus:ring-2 focus:ring-teal-400/60",
              highlighted && "ring-2 ring-teal-400/60"
            )}
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-teal-600" />
          ) : null}
        </div>

        <FloatingAnchorPanel
          anchorRef={anchorRef}
          open={panelOpen}
          preferredMaxHeight={320}
          className="rounded-md border border-slate-200 bg-white shadow-xl"
        >
          <div
            ref={listPanelRef}
            onMouseDown={(e) => e.preventDefault()}
            className="drflow-clinical-combobox-list"
          >
            {loading ? (
              <p className="px-3 py-2 text-xs text-slate-600">Buscando medicamentos…</p>
            ) : null}
            {error ? (
              <p className="px-3 py-2 text-xs font-medium text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            {!loading && !error && catalogEmpty && clinicalResults.length > 0 ? (
              <p className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
                Vademécum sin productos. Mostrando clases terapéuticas del catálogo clínico.
              </p>
            ) : null}
            {!loading && !error && listItems.length === 0 ? (
              <p className="px-3 py-2 text-xs font-medium text-slate-700">
                {catalogEmpty
                  ? `Sin resultados para "${query}". El vademécum parece vacío; usá "Buscar tratamiento" arriba o "+ Agregar medicamento".`
                  : `Sin resultados para "${query}". Probá con más letras (ej: amoxi) o usá "+ Agregar medicamento".`}
              </p>
            ) : null}
            {!loading && listItems.length > 0 ? (
              <ul id={`${listId}-listbox`} role="listbox" className="py-1">
                {listItems.map((entry, index) => {
                  if (entry.source === "separator") {
                    return (
                      <li
                        key={entry.key}
                        role="separator"
                        className="my-1 border-t border-slate-200"
                        aria-hidden
                      />
                    );
                  }

                  if (entry.source === "favorite" || entry.source === "recent") {
                    const payload = entry.payload;
                    const draft = favoriteToMedication(payload);
                    const alreadyAdded = existingKeys.has(medicationIdentityKey(draft));
                    const isFavoriteRow = entry.source === "favorite";
                    return (
                      <li key={entry.key} role="presentation">
                        <div
                          className={cn(
                            "flex w-full items-start gap-2 px-3 py-2",
                            index === highlight && "bg-amber-500/10",
                            alreadyAdded && "opacity-50"
                          )}
                          onMouseEnter={() => setHighlight(index)}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={index === highlight}
                            disabled={alreadyAdded}
                            onClick={() => handleSelectFavorite(payload)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="inline-flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-slate-900">
                              {isFavoriteRow ? (
                                <Star className="h-3 w-3 fill-current text-amber-500" aria-hidden />
                              ) : (
                                <Clock className="h-3 w-3 text-slate-500" aria-hidden />
                              )}
                              {payload.active_ingredient || payload.generic_name}
                            </p>
                            {payload.brand_name ? (
                              <p className="text-xs font-medium text-slate-700">
                                Comercial: {payload.brand_name}
                              </p>
                            ) : null}
                            <p className="text-xs text-slate-500">
                              {isFavoriteRow ? "Favorito" : "Usado recientemente"}
                            </p>
                          </button>
                          {favorites ? (
                            <FavoriteStarButton
                              active={Boolean(
                                favorites.isFavorite(
                                  "medication",
                                  medicationFavoriteFingerprint(payload)
                                )
                              )}
                              label={payload.generic_name}
                              onToggle={() => void favorites.toggleMedicationFavorite(payload)}
                            />
                          ) : null}
                        </div>
                      </li>
                    );
                  }

                  if (entry.source === "clinical") {
                    const item = entry.item;
                    const draft = clinicalToMedication(item);
                    const alreadyAdded = existingKeys.has(medicationIdentityKey(draft));
                    const payload = payloadFromMed(draft);
                    return (
                      <li key={entry.key} role="presentation">
                        <div
                          className={cn(
                            "flex w-full items-start gap-2 px-3 py-2",
                            index === highlight && "bg-sky-500/10",
                            alreadyAdded && "opacity-50"
                          )}
                          onMouseEnter={() => setHighlight(index)}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={index === highlight}
                            disabled={alreadyAdded}
                            onClick={() => handleSelectClinical(item)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-600">
                              {CLINICAL_TREATMENT_KIND_LABELS[item.kind]}
                              {item.category ? ` · ${item.category}` : ""}
                            </p>
                            {alreadyAdded ? (
                              <p className="drflow-clinical-combobox-option-added mt-0.5">Ya agregado</p>
                            ) : null}
                          </button>
                          {favorites ? (
                            <FavoriteStarButton
                              active={Boolean(
                                favorites.isFavorite(
                                  "medication",
                                  medicationFavoriteFingerprint(payload)
                                )
                              )}
                              label={item.name}
                              onToggle={() => void favorites.toggleMedicationFavorite(payload)}
                            />
                          ) : null}
                        </div>
                      </li>
                    );
                  }

                  const item = entry.item;
                  const draft = catalogToMedicationSelection(item);
                  const alreadyAdded = existingKeys.has(medicationIdentityKey(draft));
                  const brand = item.brand_name.trim();
                  const active = item.active_ingredient.trim();
                  const payload = payloadFromMed(draft);
                  const starred = Boolean(
                    favorites?.isFavorite("medication", medicationFavoriteFingerprint(payload))
                  );
                  return (
                    <li key={entry.key} role="presentation">
                      <div
                        className={cn(
                          "flex w-full items-start gap-2 px-3 py-2",
                          index === highlight && "bg-teal-500/10",
                          alreadyAdded && "drflow-clinical-combobox-option-disabled"
                        )}
                        onMouseEnter={() => setHighlight(index)}
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={index === highlight}
                          onClick={() => handleSelect(item)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                            {active}
                          </p>
                          {brand && brand.toLowerCase() !== active.toLowerCase() ? (
                            <p className="text-xs font-medium text-slate-700">Comercial: {brand}</p>
                          ) : null}
                          <p className="text-xs text-slate-600">{catalogHitMeta(item)}</p>
                          <p className="text-xs text-slate-600">
                            {formatVademecumPrescriptionSubtitle(item)}
                          </p>
                          {alreadyAdded ? (
                            <p className="drflow-clinical-combobox-option-added mt-0.5">Ya agregado</p>
                          ) : null}
                        </button>
                        {favorites ? (
                          <FavoriteStarButton
                            active={starred}
                            label={active}
                            onToggle={() => void favorites.toggleMedicationFavorite(payload)}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </FloatingAnchorPanel>

        <div className="mt-1.5 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddManual}
            disabled={!query.trim()}
          >
            + Agregar medicamento
          </Button>
        </div>

        {favorites && open ? (
          <div className="mt-2 space-y-2">
            <ClinicalFavoritesQuickList
              title="Mis medicamentos frecuentes"
              favorites={allMedicationFavorites}
              onPick={(fav) => handleSelectFavorite(payloadFromFavorite(fav))}
              onToggleFavorite={(fav) => {
                void favorites.toggleMedicationFavorite(payloadFromFavorite(fav));
              }}
            />
            <ClinicalRecentUsageQuickList
              items={allMedicationRecent.filter(
                (r) =>
                  !favorites.isFavorite(
                    "medication",
                    medicationFavoriteFingerprint(payloadFromRecent(r))
                  )
              )}
              onPick={(row) => handleSelectFavorite(payloadFromRecent(row))}
            />
          </div>
        ) : null}

        <p className="drflow-clinical-combobox-hint mt-1">
          Prioridad: ⭐ favoritos · 🕘 recientes · {medicationCatalogSearchLabel().toLowerCase()}
        </p>
      </div>

      {medications.length > 0 ? (
        <ul className="space-y-3">
          {medications.map((med, index) => {
            const payload = payloadFromMed(med);
            const starred = Boolean(
              favorites?.isFavorite("medication", medicationFavoriteFingerprint(payload))
            );
            return (
              <li
                key={`${med.vademecum_code ?? med.generic_name}-${index}`}
                className="rounded-md border border-teal-500/30 bg-teal-500/5 p-3"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">
                    {formatPrescriptionMedicationLabel({
                      ...med,
                      dose: undefined,
                      frequency: undefined,
                      posology: "",
                    })}
                  </p>
                  <div className="flex items-center gap-1">
                    {favorites ? (
                      <FavoriteStarButton
                        active={starred}
                        label={med.generic_name}
                        onToggle={() => void favorites.toggleMedicationFavorite(payload)}
                      />
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Quitar ${formatPrescriptionMedicationLabel(med)}`}
                      onClick={() => handleRemove(index)}
                      className="rounded-full p-0.5 hover:bg-teal-500/20"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs text-slate-600">
                    Medicamento
                    <input
                      type="text"
                      value={med.generic_name}
                      onChange={(e) =>
                        updateMed(index, {
                          generic_name: e.target.value,
                          active_ingredient: e.target.value,
                        })
                      }
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Nombre comercial
                    <input
                      type="text"
                      value={med.brand_name ?? ""}
                      onChange={(e) => updateMed(index, { brand_name: e.target.value })}
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Presentación
                    <input
                      type="text"
                      value={med.presentation ?? ""}
                      onChange={(e) => updateMed(index, { presentation: e.target.value })}
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Concentración
                    <input
                      type="text"
                      value={med.concentration ?? ""}
                      onChange={(e) => updateMed(index, { concentration: e.target.value })}
                      placeholder="Ej: 500 mg"
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Forma farmacéutica
                    <input
                      type="text"
                      value={med.pharmaceutical_form ?? ""}
                      onChange={(e) => updateMed(index, { pharmaceutical_form: e.target.value })}
                      placeholder="Ej: comprimidos"
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Dosis
                    <input
                      type="text"
                      value={med.dose ?? ""}
                      placeholder="Completar (ej: 500 mg)"
                      onChange={(e) => updateMed(index, { dose: e.target.value })}
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Vía
                    <input
                      type="text"
                      value={med.route ?? ""}
                      placeholder="Completar (ej: oral)"
                      onChange={(e) => updateMed(index, { route: e.target.value })}
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Frecuencia
                    <input
                      type="text"
                      value={med.frequency ?? ""}
                      placeholder="Completar (ej: cada 8 hs)"
                      onChange={(e) =>
                        updateMed(index, {
                          frequency: e.target.value,
                          posology: e.target.value,
                        })
                      }
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Duración (días)
                    <input
                      type="number"
                      min={1}
                      value={med.duration_days ?? ""}
                      placeholder="Completar"
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        updateMed(index, {
                          duration_days: raw === "" ? undefined : Number(raw),
                        });
                      }}
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs text-slate-600">
                    Cantidad
                    <input
                      type="number"
                      min={0}
                      value={med.quantity || ""}
                      placeholder="Completar"
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        updateMed(index, { quantity: raw === "" ? 0 : Number(raw) });
                      }}
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs text-slate-600 sm:col-span-2">
                    Indicaciones
                    <input
                      type="text"
                      value={med.instructions ?? ""}
                      placeholder="Indicaciones específicas del medicamento"
                      onChange={(e) => updateMed(index, { instructions: e.target.value })}
                      className="drflow-clinical-combobox-input mt-1 w-full rounded-md px-2 py-1.5 text-xs"
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
