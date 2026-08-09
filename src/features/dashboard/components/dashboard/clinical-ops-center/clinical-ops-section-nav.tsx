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
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50",
                isActive
                  ? "bg-teal-950/50 text-teal-100"
                  : "text-slate-300 hover:bg-slate-800 hover:text-teal-200"
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", isActive ? "text-teal-300" : "text-slate-500")}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {count > 0 ? (
                <span className="rounded-full bg-slate-800 px-1.5 text-xs font-bold text-teal-300">
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
