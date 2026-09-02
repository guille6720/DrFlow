"use client";

import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/shared/utils/cn";

import {
  type ClinicalOpsSectionId,
  scrollToClinicalOpsSection,
} from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-scroll";

type NavItem = {
  id: ClinicalOpsSectionId;
  label: string;
  icon: LucideIcon;
};

type Props = {
  items: readonly NavItem[];
  counts: Partial<Record<ClinicalOpsSectionId, number>>;
};

export function ClinicalOpsSectionNav({ items, counts }: Props) {
  const [activeId, setActiveId] = useState<ClinicalOpsSectionId | null>(null);

  useEffect(() => {
    const sectionIds = items.map((item) => item.id);
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        const top = visible[0]?.target.id;
        if (top && sectionIds.includes(top as ClinicalOpsSectionId)) {
          setActiveId(top as ClinicalOpsSectionId);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.4, 0.75] }
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [items]);

  const handleNavigate = useCallback((sectionId: ClinicalOpsSectionId) => {
    setActiveId(sectionId);
    scrollToClinicalOpsSection(sectionId);
  }, []);

  return (
    <ul className="space-y-0.5">
      {items.map(({ id, label, icon: Icon }) => {
        const count = counts[id] ?? 0;
        const isActive = activeId === id;

        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => handleNavigate(id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                isActive
                  ? "bg-[var(--sidebar-active-bg,#0f766e)] text-white"
                  : "text-[var(--text-primary,#172033)] hover:bg-[var(--surface-hover,#f1f5f9)]"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-white" : "text-[var(--sidebar-accent,#0f766e)]"
                )}
                strokeWidth={2.25}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-bold ring-1",
                    isActive
                      ? "bg-white/20 text-white ring-white/30"
                      : "bg-[var(--accent-soft,#ccfbf1)] text-[var(--sidebar-accent,#0f766e)] ring-[color-mix(in_srgb,var(--sidebar-accent,#0f766e)_25%,transparent)]"
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
