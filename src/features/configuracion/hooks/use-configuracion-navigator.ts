"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CONFIGURACION_HASH_ALIASES,
  getGroupForSection,
  type ConfiguracionGroupId,
  type ConfiguracionSectionId,
} from "@/features/configuracion/components/configuracion/configuracion-sections";

export function useConfiguracionNavigator(
  activeGroup: ConfiguracionGroupId | null,
  activeSection: ConfiguracionSectionId | null
) {
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

  return {
    resolvedGroup,
    openGroup,
    openSection,
    goToHub,
    goToGroup,
  };
}
