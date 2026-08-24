"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { useEntitlementsSnapshot } from "@/core/components/entitlements/entitlements-provider";
import { isConfiguracionSectionEntitledBySnapshot } from "@/core/entitlements/config-features";
import { isHrefEntitledBySnapshot } from "@/core/entitlements/nav-features";

import { cn } from "@/shared/utils/cn";

import { ConfiguracionSectionCard } from "@/features/configuracion/components/configuracion/configuracion-section-card";
import {
  CONFIGURACION_GROUPS,
  type ConfiguracionGroupId,
  type ConfiguracionSectionId,
  getGroupMeta,
  getSectionMeta,
  getSectionsForGroup,
} from "@/features/configuracion/components/configuracion/configuracion-sections";

import { Button } from "@/components/ui/button";

export function ConfiguracionNavigatorSectionView({
  activeSection,
  resolvedGroup,
  sectionContent,
  onBack,
}: {
  activeSection: ConfiguracionSectionId;
  resolvedGroup: ConfiguracionGroupId | null;
  sectionContent?: ReactNode;
  onBack: () => void;
}) {
  const meta = getSectionMeta(activeSection);
  const groupMeta = resolvedGroup ? getGroupMeta(resolvedGroup) : null;

  if (!meta || !sectionContent) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Volver a configuración
        </Button>
        <p className="text-sm text-slate-400">Sección no encontrada.</p>
      </div>
    );
  }

  const Icon = meta.icon;

  return (
    <div className="drflow-config-hub space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div className="drflow-card-light flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            {groupMeta && (
              <p className="text-xs font-medium uppercase tracking-wide text-teal-800">
                {groupMeta.title}
              </p>
            )}
            <h2 className="truncate font-semibold text-slate-900">{meta.title}</h2>
            <p className="truncate text-sm text-slate-700">{meta.description}</p>
          </div>
        </div>
      </div>

      <div>{sectionContent}</div>
    </div>
  );
}

export function ConfiguracionNavigatorGroupView({
  activeGroup,
  onBack,
  onOpenSection,
}: {
  activeGroup: ConfiguracionGroupId;
  onBack: () => void;
  onOpenSection: (id: ConfiguracionSectionId) => void;
}) {
  const group = getGroupMeta(activeGroup);
  if (!group) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Volver a configuración
        </Button>
        <p className="text-sm text-slate-400">Grupo no encontrado.</p>
      </div>
    );
  }

  const GroupIcon = group.icon;
  const sections = getSectionsForGroup(activeGroup);

  return (
    <div className="drflow-config-hub space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div className="drflow-card-light flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
            <GroupIcon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-900">{group.title}</h2>
            <p className="truncate text-sm text-slate-700">{group.description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <ConfiguracionSectionCard
            key={section.id}
            sectionId={section.id}
            onOpen={onOpenSection}
            compact
          />
        ))}
      </div>
    </div>
  );
}

export function ConfiguracionNavigatorHubView({
  onOpenGroup,
  deleteAccount,
}: {
  onOpenGroup: (id: ConfiguracionGroupId) => void;
  deleteAccount?: ReactNode;
}) {
  const snapshot = useEntitlementsSnapshot();
  return (
    <div className="drflow-config-hub space-y-6">
      <div className="drflow-card-light rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">¿Qué querés configurar?</h2>
        <p className="mt-1 text-sm text-slate-700">
          Elegí un área. Dentro de cada grupo vas a encontrar las opciones relacionadas, sin tener
          que recorrer toda la configuración de una sola vez.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CONFIGURACION_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          const sections = getSectionsForGroup(group.id);
          if (sections.length === 0) return null;

          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onOpenGroup(group.id)}
              className={cn(
                "drflow-card-light group flex min-h-[10rem] flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left text-slate-900",
                "shadow-sm transition hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800 group-hover:bg-teal-200/80">
                  <GroupIcon className="h-6 w-6" aria-hidden />
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 group-hover:text-teal-600" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">{group.title}</p>
              <p className="mt-1 text-sm leading-snug text-slate-700">{group.description}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {sections.map((section) => {
                  const locked =
                    !isConfiguracionSectionEntitledBySnapshot(section.id, snapshot) ||
                    (Boolean(section.href) && !isHrefEntitledBySnapshot(section.href!, snapshot));
                  return (
                    <li
                      key={section.id}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        locked
                          ? "bg-amber-100 text-amber-950"
                          : "bg-slate-200/90 text-slate-800 group-hover:bg-teal-100 group-hover:text-teal-900"
                      )}
                    >
                      {section.title}
                    </li>
                  );
                })}
              </ul>
            </button>
          );
        })}
        {deleteAccount}
      </div>
    </div>
  );
}
