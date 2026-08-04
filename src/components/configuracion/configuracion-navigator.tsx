"use client";

import type { ReactNode } from "react";
import { useConfiguracionNavigator } from "@/lib/hooks/use-configuracion-navigator";
import {
  ConfiguracionNavigatorGroupView,
  ConfiguracionNavigatorHubView,
  ConfiguracionNavigatorSectionView,
} from "@/components/configuracion/configuracion-navigator-views";
import type {
  ConfiguracionGroupId,
  ConfiguracionSectionId,
} from "@/components/configuracion/configuracion-sections";

interface ConfiguracionNavigatorProps {
  activeGroup: ConfiguracionGroupId | null;
  activeSection: ConfiguracionSectionId | null;
  sectionContent?: ReactNode;
  deleteAccount?: ReactNode;
}

export function ConfiguracionNavigator({
  activeGroup,
  activeSection,
  sectionContent,
  deleteAccount,
}: ConfiguracionNavigatorProps) {
  const { resolvedGroup, openGroup, openSection, goToHub, goToGroup } =
    useConfiguracionNavigator(activeGroup, activeSection);

  if (activeSection) {
    return (
      <ConfiguracionNavigatorSectionView
        activeSection={activeSection}
        resolvedGroup={resolvedGroup}
        sectionContent={sectionContent}
        onBack={goToGroup}
      />
    );
  }

  if (activeGroup) {
    return (
      <ConfiguracionNavigatorGroupView
        activeGroup={activeGroup}
        onBack={goToHub}
        onOpenSection={openSection}
      />
    );
  }

  return (
    <ConfiguracionNavigatorHubView onOpenGroup={openGroup} deleteAccount={deleteAccount} />
  );
}
