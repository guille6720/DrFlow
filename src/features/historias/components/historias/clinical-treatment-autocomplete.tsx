"use client";

import { Clock, Loader2, Star, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { searchClinicalTreatments } from "@/features/historias/actions/clinical-treatments";
import { useClinicalFavoritesOptional } from "@/features/historias/components/historias/clinical-favorites-provider";
import { ClinicalFavoritesQuickList } from "@/features/historias/components/historias/clinical-favorites-quick-list";
import { ClinicalRecentUsageQuickList } from "@/features/historias/components/historias/clinical-recent-usage-quick-list";
import { FavoriteStarButton } from "@/features/historias/components/historias/favorite-star-button";
import {
  type ClinicalFavoriteRow,
  type ClinicalFavoriteTreatmentPayload,
  treatmentFavoriteFingerprint,
} from "@/features/historias/types/clinical-favorites";
import type { ClinicalRecentUsageRow } from "@/features/historias/types/clinical-recent-usage";
import type { ClinicalTreatmentCatalogHit } from "@/features/historias/types/clinical-treatment-catalog";
import { CLINICAL_TREATMENT_KIND_LABELS } from "@/features/historias/types/clinical-treatment-catalog";
import type { ClinicalTreatmentEntry } from "@/features/historias/utils/clinical-structured-entries";

import { Button } from "@/components/ui/button";

type Props = {
  treatments: ClinicalTreatmentEntry[];
  onTreatmentsChange: (treatments: ClinicalTreatmentEntry[]) => void;
  className?: string;
  highlighted?: boolean;
  label?: string;
  placeholder?: string;
  kindFilter?: ClinicalTreatmentCatalogHit["kind"];
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
};

function entryKey(entry: ClinicalTreatmentEntry): string {
  return `${entry.clinical_treatment_id ?? ""}|${entry.kind ?? ""}|${entry.product}`
    .trim()
    .toLowerCase();
}

function payloadFromFavorite(fav: ClinicalFavoriteRow): ClinicalFavoriteTreatmentPayload {
  const raw = fav.payload as ClinicalFavoriteTreatmentPayload;
  return {
    product: raw.product?.trim() || fav.label,
    kind: raw.kind ?? null,
    category: raw.category ?? null,
    clinical_treatment_id: raw.clinical_treatment_id ?? null,
  };
}

function payloadFromRecent(row: ClinicalRecentUsageRow): ClinicalFavoriteTreatmentPayload {
  const raw = row.payload as ClinicalFavoriteTreatmentPayload;
  return {
    product: raw.product?.trim() || row.label,
    kind: raw.kind ?? null,
    category: raw.category ?? null,
    clinical_treatment_id: raw.clinical_treatment_id ?? null,
  };
}

type ListItem =
  | { source: "favorite"; key: string; payload: ClinicalFavoriteTreatmentPayload }
  | { source: "recent"; key: string; payload: ClinicalFavoriteTreatmentPayload }
  | { source: "separator"; key: string }
  | { source: "catalog"; key: string; item: ClinicalTreatmentCatalogHit };

export function ClinicalTreatmentAutocomplete({
  treatments,
  onTreatmentsChange,
  className,
  highlighted = false,
  label = "Tratamiento / conducta",
  placeholder = "Buscar tratamiento…",
  kindFilter,
  searchInputRef,
}: Props) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const favorites = useClinicalFavoritesOptional();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClinicalTreatmentCatalogHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selectedKeys = useMemo(() => new Set(treatments.map(entryKey)), [treatments]);
  const allTreatmentFavorites = favorites?.byKind("treatment") ?? [];
  const allTreatmentRecent = favorites?.recentByKind("treatment") ?? [];

  const listItems = useMemo<ListItem[]>(() => {
    const matchingFavorites = favorites?.matchingFavorites("treatment", query) ?? [];
    const matchingRecent = favorites?.matchingRecent("treatment", query) ?? [];
    const favoriteItems: ListItem[] = matchingFavorites.map((favorite) => ({
      source: "favorite",
      key: `fav:${favorite.id}`,
      payload: payloadFromFavorite(favorite),
    }));
    const seen = new Set(
      favoriteItems.map((item) =>
        item.source === "favorite" ? treatmentFavoriteFingerprint(item.payload) : ""
      )
    );

    const recentItems: ListItem[] = [];
    for (const row of matchingRecent) {
      const payload = payloadFromRecent(row);
      const fp = treatmentFavoriteFingerprint(payload);
      if (seen.has(fp)) continue;
      seen.add(fp);
      recentItems.push({ source: "recent", key: `rec:${row.id}`, payload });
    }

    const catalogItems: ListItem[] = results
      .filter((item) => {
        const fp = treatmentFavoriteFingerprint({
          product: item.name,
          kind: item.kind,
          clinical_treatment_id: item.id,
        });
        return !seen.has(fp);
      })
      .map((item) => ({ source: "catalog" as const, key: `cat:${item.id}`, item }));

    const prioritized = [...favoriteItems, ...recentItems];
    if (prioritized.length > 0 && catalogItems.length > 0) {
      return [...prioritized, { source: "separator", key: "sep" }, ...catalogItems];
    }
    return [...prioritized, ...catalogItems];
  }, [favorites, query, results]);

  function assignInputRef(node: HTMLInputElement | null) {
    localInputRef.current = node;
    if (searchInputRef) searchInputRef.current = node;
  }

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      const res = await searchClinicalTreatments(q, { limit: 12, kind: kindFilter });
      setLoading(false);
      if (res.error) {
        setError(res.error);
        setResults([]);
        return;
      }
      setResults(res.data ?? []);
      setHighlight(0);
    },
    [kindFilter]
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void search(query), 280);
    return () => window.clearTimeout(timer);
  }, [query, open, search]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addEntry(entry: ClinicalTreatmentEntry) {
    const key = entryKey(entry);
    if (selectedKeys.has(key)) return;
    onTreatmentsChange([...treatments, entry]);
    void favorites?.rememberTreatmentUsage({
      product: entry.product,
      kind: entry.kind ?? null,
      category: entry.category ?? null,
      clinical_treatment_id: entry.clinical_treatment_id ?? null,
    });
  }

  function handleSelect(item: ClinicalTreatmentCatalogHit) {
    addEntry({
      product: item.name,
      kind: item.kind,
      category: item.category,
      clinical_treatment_id: item.id,
      status: "Actual",
      catalog_source: "clinical_treatments",
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function handleSelectFavorite(payload: ClinicalFavoriteTreatmentPayload) {
    addEntry({
      product: payload.product,
      kind: (payload.kind as ClinicalTreatmentEntry["kind"]) ?? "free_text",
      category: payload.category ?? "Favorito",
      clinical_treatment_id: payload.clinical_treatment_id ?? null,
      status: "Actual",
      catalog_source: "clinical_favorite",
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function handleAddFreeText() {
    const name = query.trim();
    if (!name) return;
    addEntry({
      product: name,
      kind: kindFilter ?? "free_text",
      category: kindFilter ? CLINICAL_TREATMENT_KIND_LABELS[kindFilter] : "Texto libre",
      status: "Actual",
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function handleRemove(index: number) {
    onTreatmentsChange(treatments.filter((_, i) => i !== index));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && listItems.length > 0) {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, listItems.length - 1));
      return;
    }
    if (event.key === "ArrowUp" && listItems.length > 0) {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = listItems[highlight];
      if (item?.source === "favorite" || item?.source === "recent") handleSelectFavorite(item.payload);
      else if (item?.source === "catalog") handleSelect(item.item);
      else handleAddFreeText();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div ref={containerRef} className="relative space-y-1.5">
        <label htmlFor={listId} className="mb-1.5 block text-sm font-medium drflow-ehr-label">
          {label}
        </label>
        <input
          ref={assignInputRef}
          id={listId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${listId}-listbox`}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={cn(
            "drflow-clinical-combobox-input w-full rounded-md py-2.5 px-3 focus:ring-2 focus:ring-sky-400/50",
            highlighted && "ring-2 ring-sky-400/50"
          )}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddFreeText}
            disabled={!query.trim()}
          >
            + Agregar tratamiento
          </Button>
        </div>

        {favorites ? (
          <>
            <ClinicalFavoritesQuickList
              title="Mis tratamientos frecuentes"
              favorites={allTreatmentFavorites}
              onPick={(fav) => handleSelectFavorite(payloadFromFavorite(fav))}
              onToggleFavorite={(fav) => {
                void favorites.toggleTreatmentFavorite(payloadFromFavorite(fav));
              }}
            />
            <ClinicalRecentUsageQuickList
              items={allTreatmentRecent.filter(
                (r) =>
                  !favorites.isFavorite(
                    "treatment",
                    treatmentFavoriteFingerprint(payloadFromRecent(r))
                  )
              )}
              onPick={(row) => handleSelectFavorite(payloadFromRecent(row))}
            />
          </>
        ) : null}

        {loading ? (
          <p className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
          </p>
        ) : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        {open && listItems.length > 0 ? (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className="drflow-clinical-combobox-list absolute z-[100] mt-1 max-h-80 w-full overflow-y-auto rounded-md py-1 shadow-lg"
          >
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
                const isFavoriteRow = entry.source === "favorite";
                return (
                  <li key={entry.key} role="presentation">
                    <div
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2",
                        index === highlight && "bg-amber-500/10"
                      )}
                      onMouseEnter={() => setHighlight(index)}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === highlight}
                        onClick={() => handleSelectFavorite(payload)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                          {isFavoriteRow ? (
                            <Star className="h-3 w-3 fill-current text-amber-500" aria-hidden />
                          ) : (
                            <Clock className="h-3 w-3 text-slate-500" aria-hidden />
                          )}
                          {payload.product}
                        </p>
                        <p className="text-xs text-slate-500">
                          {isFavoriteRow ? "Favorito" : "Usado recientemente"}
                        </p>
                      </button>
                      {favorites ? (
                        <FavoriteStarButton
                          active={Boolean(
                            favorites.isFavorite(
                              "treatment",
                              treatmentFavoriteFingerprint(payload)
                            )
                          )}
                          label={payload.product}
                          onToggle={() => void favorites.toggleTreatmentFavorite(payload)}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              }

              const item = entry.item;
              const payload: ClinicalFavoriteTreatmentPayload = {
                product: item.name,
                kind: item.kind,
                category: item.category,
                clinical_treatment_id: item.id,
              };
              const already = selectedKeys.has(
                `${item.id}|${item.kind}|${item.name}`.trim().toLowerCase()
              );
              const starred = Boolean(
                favorites?.isFavorite("treatment", treatmentFavoriteFingerprint(payload))
              );
              return (
                <li key={entry.key} role="presentation">
                  <div
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2",
                      index === highlight && "bg-sky-500/10",
                      already && "opacity-50"
                    )}
                    onMouseEnter={() => setHighlight(index)}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === highlight}
                      disabled={already}
                      onClick={() => handleSelect(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {CLINICAL_TREATMENT_KIND_LABELS[item.kind]}
                        {already ? " · Ya agregado" : ""}
                      </p>
                    </button>
                    {favorites ? (
                      <FavoriteStarButton
                        active={starred}
                        label={item.name}
                        onToggle={() => void favorites.toggleTreatmentFavorite(payload)}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        <p className="drflow-clinical-combobox-hint text-xs">
          Prioridad: ⭐ favoritos · 🕘 recientes · catálogo
        </p>
      </div>

      {treatments.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {treatments.map((t, index) => {
            const payload: ClinicalFavoriteTreatmentPayload = {
              product: t.product,
              kind: t.kind ?? null,
              category: t.category ?? null,
              clinical_treatment_id: t.clinical_treatment_id ?? null,
            };
            const starred = Boolean(
              favorites?.isFavorite("treatment", treatmentFavoriteFingerprint(payload))
            );
            return (
              <li
                key={`${entryKey(t)}-${index}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800"
              >
                <span className="truncate font-medium">{t.product}</span>
                {favorites ? (
                  <FavoriteStarButton
                    active={starred}
                    label={t.product}
                    onToggle={() => void favorites.toggleTreatmentFavorite(payload)}
                  />
                ) : null}
                <button
                  type="button"
                  aria-label={`Quitar ${t.product}`}
                  onClick={() => handleRemove(index)}
                  className="rounded-full p-0.5 hover:bg-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
