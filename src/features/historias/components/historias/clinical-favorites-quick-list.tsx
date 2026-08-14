"use client";

import { Star } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import { FavoriteStarButton } from "@/features/historias/components/historias/favorite-star-button";
import type { ClinicalFavoriteRow } from "@/features/historias/types/clinical-favorites";

type Props = {
  title: string;
  favorites: ClinicalFavoriteRow[];
  onPick: (favorite: ClinicalFavoriteRow) => void;
  onToggleFavorite: (favorite: ClinicalFavoriteRow) => void;
  className?: string;
  emptyHint?: string;
};

export function ClinicalFavoritesQuickList({
  title,
  favorites,
  onPick,
  onToggleFavorite,
  className,
  emptyHint,
}: Props) {
  if (favorites.length === 0) {
    if (!emptyHint) return null;
    return (
      <p className={cn("text-xs text-slate-500", className)}>
        {emptyHint}
      </p>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
        <Star className="h-3 w-3 fill-current text-amber-500" aria-hidden />
        {title}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {favorites.map((fav) => (
          <li key={fav.id}>
            <div className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 pl-2.5 pr-1 py-1 text-xs text-slate-800">
              <button
                type="button"
                onClick={() => onPick(fav)}
                className="truncate font-medium hover:text-amber-950"
              >
                {fav.label}
              </button>
              <FavoriteStarButton
                active
                label={fav.label}
                onToggle={() => onToggleFavorite(fav)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
