"use client";

import type { ReactNode } from "react";
import { useConfiguracionNavigator } from "@/features/configuracion/hooks/use-configuracion-navigator";
import {
  ConfiguracionNavigatorGroupView,
  ConfiguracionNavigatorHubView,
  ConfiguracionNavigatorSectionView,
} from "@/features/configuracion/components/configuracion/configuracion-navigator-views";
import type {
  ConfiguracionGroupId,
  ConfiguracionSectionId,
} from "@/features/configuracion/components/configuracion/configuracion-sections";

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
