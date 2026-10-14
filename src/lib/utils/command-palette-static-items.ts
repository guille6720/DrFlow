import { type FeatureMap, isHrefAllowedByCustomizations } from "@/core/customizations/resolve";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";
import type { PermissionOverrides } from "@/core/permissions/roles";

import {
  buildPatientContextPaletteActions,
  COMMAND_PALETTE_ACTIONS,
  COMMAND_PALETTE_NAV,
  type CommandPaletteItemDef,
} from "@/lib/constants/command-palette-items";
import { filterCommandPaletteItems } from "@/lib/utils/command-palette-search";
import type { UserRole } from "@/types/database";

const RCTA_PRESCRIPTION_ITEM_IDS = new Set(["action-new-prescription", "ctx-rx"]);

export type CommandPaletteStaticItemsInput = {
  activePatientId: string | null;
  query: string;
  role: UserRole | null;
  isSuperadmin: boolean;
  permissionOverrides?: PermissionOverrides;
  entitlements?: ClientEntitlementsSnapshot | null;
  customizationFeatures?: FeatureMap | null;
  rcta: { enabled: boolean; href: string };
};

/**
 * Static palette items: patient-context actions, global actions and navigation, filtered by
 * role/permissions/entitlements, clinic customizations, with prescription items routed to RCTA
 * when that integration is enabled.
 */
export function buildCommandPaletteStaticItems({
  activePatientId,
  query,
  role,
  isSuperadmin,
  permissionOverrides,
  entitlements,
  customizationFeatures,
  rcta,
}: CommandPaletteStaticItemsInput): CommandPaletteItemDef[] {
  const filter = (items: CommandPaletteItemDef[]) =>
    filterCommandPaletteItems(items, query, role, isSuperadmin, permissionOverrides, entitlements);

  const ctx = activePatientId ? filter(buildPatientContextPaletteActions(activePatientId)) : [];

  return [...ctx, ...filter(COMMAND_PALETTE_ACTIONS), ...filter(COMMAND_PALETTE_NAV)]
    .filter((item) => isHrefAllowedByCustomizations(item.href, customizationFeatures))
    .map((item) =>
      rcta.enabled && RCTA_PRESCRIPTION_ITEM_IDS.has(item.id) ? { ...item, href: rcta.href } : item
    );
}
