"use client";

import { ChevronRight, Lock } from "lucide-react";
import Link from "next/link";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { useEntitlementsSnapshot } from "@/core/components/entitlements/entitlements-provider";
import {
  configuracionSectionFeature,
  isConfiguracionSectionEntitledBySnapshot,
} from "@/core/entitlements/config-features";
import {
  isHrefEntitledBySnapshot,
  navFeatureForHref,
} from "@/core/entitlements/nav-features";

import { cn } from "@/shared/utils/cn";

import {
  type ConfiguracionSectionId,
  getSectionMeta,
} from "@/features/configuracion/components/configuracion/configuracion-sections";

const cardClassName = (compact: boolean, locked: boolean) =>
  cn(
    "drflow-card-light group flex w-full flex-col rounded-2xl border bg-white text-left text-slate-900 shadow-sm transition",
    locked
      ? "cursor-default border-amber-200 bg-amber-50/40"
      : "border-slate-200 hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50",
    compact ? "min-h-[5.5rem] p-4" : "min-h-[7rem] p-5"
  );

function SectionCardContent({
  title,
  description,
  compact,
  Icon,
  locked,
}: {
  title: string;
  description: string;
  compact: boolean;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  locked?: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl",
            locked
              ? "bg-amber-100 text-amber-900"
              : "bg-teal-100 text-teal-800 group-hover:bg-teal-200/80",
            compact ? "h-9 w-9" : "h-11 w-11"
          )}
        >
          {locked ? (
            <Lock className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
          ) : (
            <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
          )}
        </div>
        {!locked ? (
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 group-hover:text-teal-600" />
        ) : null}
      </div>
      <p className={cn("mt-3 font-semibold text-slate-900", compact && "text-sm")}>{title}</p>
      <p className={cn("mt-1 leading-snug text-slate-700", compact ? "text-xs" : "text-sm")}>
        {description}
      </p>
    </>
  );
}

export function ConfiguracionSectionCard({
  sectionId,
  onOpen,
  compact = false,
}: {
  sectionId: ConfiguracionSectionId;
  onOpen: (id: ConfiguracionSectionId) => void;
  compact?: boolean;
}) {
  const snapshot = useEntitlementsSnapshot();
  const section = getSectionMeta(sectionId);
  if (!section) return null;

  const sectionEntitled = isConfiguracionSectionEntitledBySnapshot(section.id, snapshot);
  const hrefEntitled = !section.href || isHrefEntitledBySnapshot(section.href, snapshot);
  const locked = !sectionEntitled || !hrefEntitled;
  const lockedFeature =
    configuracionSectionFeature(section.id) ??
    (section.href ? navFeatureForHref(section.href) : undefined);
  const Icon = section.icon;

  if (locked) {
    if (!lockedFeature) return null;
    return (
      <div className={cardClassName(compact, true)}>
        <SectionCardContent
          title={section.title}
          description={section.description}
          compact={compact}
          Icon={Icon}
          locked
        />
        <div className="mt-3">
          <AddonUpgradeNotice feature={lockedFeature} />
        </div>
      </div>
    );
  }

  if (section.href) {
    return (
      <Link href={section.href} className={cardClassName(compact, false)}>
        <SectionCardContent
          title={section.title}
          description={section.description}
          compact={compact}
          Icon={Icon}
        />
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => onOpen(sectionId)} className={cardClassName(compact, false)}>
      <SectionCardContent
        title={section.title}
        description={section.description}
        compact={compact}
        Icon={Icon}
      />
    </button>
  );
}
