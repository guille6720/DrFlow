"use client";

import {
  Children,
  isValidElement,
  useEffect,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  CONFIGURACION_GROUPS,
  CONFIGURACION_HASH_ALIASES,
  getGroupForSection,
  getGroupMeta,
  getSectionMeta,
  getSectionsForGroup,
  type ConfiguracionGroupId,
  type ConfiguracionSectionId,
} from "@/components/configuracion/configuracion-sections";

interface ConfiguracionSectionProps {
  id: ConfiguracionSectionId;
  children: ReactNode;
}

export function ConfiguracionSection({ children }: ConfiguracionSectionProps) {
  return <>{children}</>;
}

ConfiguracionSection.displayName = "ConfiguracionSection";

interface ConfiguracionNavigatorProps {
  activeGroup: ConfiguracionGroupId | null;
  activeSection: ConfiguracionSectionId | null;
  children: ReactNode;
}

function collectSections(children: ReactNode): Map<ConfiguracionSectionId, ReactNode> {
  const map = new Map<ConfiguracionSectionId, ReactNode>();
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<ConfiguracionSectionProps>;
    if (el.type === ConfiguracionSection && el.props.id) {
      map.set(el.props.id, el.props.children);
    }
  });
  return map;
}

function SectionCard({
  sectionId,
  onOpen,
  compact = false,
}: {
  sectionId: ConfiguracionSectionId;
  onOpen: (id: ConfiguracionSectionId) => void;
  compact?: boolean;
}) {
  const section = getSectionMeta(sectionId);
  if (!section) return null;
  const Icon = section.icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(sectionId)}
      className={cn(
        "group flex w-full flex-col rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition",
        "hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50",
        compact ? "min-h-[5.5rem] p-4" : "min-h-[7rem] p-5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 group-hover:bg-teal-200/80",
            compact ? "h-9 w-9" : "h-11 w-11"
          )}
        >
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 group-hover:text-teal-500" />
      </div>
      <p className={cn("mt-3 font-semibold text-slate-900", compact && "text-sm")}>{section.title}</p>
      <p className={cn("mt-1 leading-snug text-slate-600", compact ? "text-xs" : "text-sm")}>
        {section.description}
      </p>
    </button>
  );
}

export function ConfiguracionNavigator({
  activeGroup,
  activeSection,
  children,
}: ConfiguracionNavigatorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const resolvedGroup =
    activeGroup ?? (activeSection ? getGroupForSection(activeSection) : null);

  useEffect(() => {
    if (activeSection || activeGroup || typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    const alias = CONFIGURACION_HASH_ALIASES[hash];
    if (alias) {
      const group = getGroupForSection(alias);
      const params = new URLSearchParams();
      if (group) params.set("grupo", group);
      params.set("seccion", alias);
      router.replace(`/configuracion?${params.toString()}`);
    }
  }, [activeSection, activeGroup, router]);

  const sectionContent = collectSections(children);

  function openGroup(id: ConfiguracionGroupId) {
    router.push(`/configuracion?grupo=${id}`);
  }

  function openSection(id: ConfiguracionSectionId) {
    const group = getGroupForSection(id);
    const params = new URLSearchParams(searchParams.toString());
    if (group) params.set("grupo", group);
    params.set("seccion", id);
    router.push(`/configuracion?${params.toString()}`);
  }

  function goToHub() {
    router.push("/configuracion");
  }

  function goToGroup() {
    if (resolvedGroup) {
      router.push(`/configuracion?grupo=${resolvedGroup}`);
    } else {
      goToHub();
    }
  }

  // Nivel 3: contenido de una sección
  if (activeSection) {
    const meta = getSectionMeta(activeSection);
    const content = sectionContent.get(activeSection);
    const groupMeta = resolvedGroup ? getGroupMeta(resolvedGroup) : null;

    if (!meta || !content) {
      return (
        <div className="space-y-4">
          <Button type="button" variant="outline" onClick={goToHub}>
            <ArrowLeft className="h-4 w-4" />
            Volver a configuración
          </Button>
          <p className="text-sm text-slate-600">Sección no encontrada.</p>
        </div>
      );
    }

    const Icon = meta.icon;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={goToGroup}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              {groupMeta && (
                <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
                  {groupMeta.title}
                </p>
              )}
              <h2 className="truncate font-semibold text-slate-900">{meta.title}</h2>
              <p className="truncate text-sm text-slate-600">{meta.description}</p>
            </div>
          </div>
        </div>

        <div>{content}</div>
      </div>
    );
  }

  // Nivel 2: subsecciones de un grupo
  if (activeGroup) {
    const group = getGroupMeta(activeGroup);
    if (!group) {
      return (
        <div className="space-y-4">
          <Button type="button" variant="outline" onClick={goToHub}>
            <ArrowLeft className="h-4 w-4" />
            Volver a configuración
          </Button>
          <p className="text-sm text-slate-600">Grupo no encontrado.</p>
        </div>
      );
    }

    const GroupIcon = group.icon;
    const sections = getSectionsForGroup(activeGroup);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={goToHub}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
              <GroupIcon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-slate-900">{group.title}</h2>
              <p className="truncate text-sm text-slate-600">{group.description}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              sectionId={section.id}
              onOpen={openSection}
              compact
            />
          ))}
        </div>
      </div>
    );
  }

  // Nivel 1: hub principal con grupos
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-teal-50/40 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">¿Qué querés configurar?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Elegí un área. Dentro de cada grupo vas a encontrar las opciones relacionadas, sin tener
          que recorrer toda la configuración de una sola vez.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CONFIGURACION_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          const sections = getSectionsForGroup(group.id);

          return (
            <button
              key={group.id}
              type="button"
              onClick={() => openGroup(group.id)}
              className={cn(
                "group flex min-h-[10rem] flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left",
                "shadow-sm transition hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 group-hover:bg-teal-200/80">
                  <GroupIcon className="h-6 w-6" aria-hidden />
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 group-hover:text-teal-500" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">{group.title}</p>
              <p className="mt-1 text-sm leading-snug text-slate-600">{group.description}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {sections.map((section) => (
                  <li
                    key={section.id}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 group-hover:bg-teal-100/80 group-hover:text-teal-800"
                  >
                    {section.title}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
