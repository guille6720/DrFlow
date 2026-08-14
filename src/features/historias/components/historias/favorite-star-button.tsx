"use client";

import { Star } from "lucide-react";

import { cn } from "@/shared/utils/cn";

type Props = {
  active: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
  stopPropagation?: boolean;
};

export function FavoriteStarButton({
  active,
  onToggle,
  label,
  className,
  stopPropagation = true,
}: Props) {
  return (
    <button
      type="button"
      aria-label={active ? `Quitar ${label} de favoritos` : `Marcar ${label} como favorito`}
      aria-pressed={active}
      onClick={(event) => {
        if (stopPropagation) {
          event.preventDefault();
          event.stopPropagation();
        }
        onToggle();
      }}
      className={cn(
        "rounded-full p-0.5 transition",
        active
          ? "text-amber-500 hover:bg-amber-100"
          : "text-slate-300 hover:bg-slate-100 hover:text-amber-500",
        className
      )}
    >
      <Star className={cn("h-3.5 w-3.5", active && "fill-current")} />
    </button>
  );
}
