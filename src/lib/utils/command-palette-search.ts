import { isHrefEntitledBySnapshot } from "@/core/entitlements/nav-features";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";
import { hasPermission, type PermissionOverrides } from "@/core/permissions/roles";

import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import type { CommandPaletteItemDef } from "@/lib/constants/command-palette-items";
import type { UserRole } from "@/types/database";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function filterCommandPaletteItems(
  items: CommandPaletteItemDef[],
  query: string,
  role: UserRole | null,
  isSuperadmin: boolean,
  permissionOverrides?: PermissionOverrides,
  entitlements?: ClientEntitlementsSnapshot | null
): CommandPaletteItemDef[] {
  const permitted = items.filter(
    (item) =>
      (!item.permission || hasPermission(role, item.permission, isSuperadmin, permissionOverrides)) &&
      isHrefEntitledBySnapshot(item.href, entitlements ?? null)
  );

  const q = normalize(query.trim());
  if (!q) return permitted.slice(0, 12);

  const qDigits = q.replace(/\D/g, "");

  return permitted
    .filter((item) => {
      const blob = normalize(
        [item.label, item.description ?? "", ...(item.keywords ?? [])].join(" ")
      );
      if (blob.includes(q)) return true;
      if (qDigits.length >= 3 && blob.replace(/\D/g, "").includes(qDigits)) return true;
      return false;
    })
    .slice(0, 12);
}

export type CommandPalettePatientHit = {
  id: string;
  label: string;
  description: string;
  href: string;
  soapHref: string;
  rxHref: string;
};

export function mapPatientHits(
  rows: { id: string; first_name: string; last_name: string; document_number: string }[]
): CommandPalettePatientHit[] {
  return rows.map((p) => ({
    id: p.id,
    label: `${p.last_name}, ${p.first_name}`,
    description: `DNI ${p.document_number}`,
    href: `/pacientes/${p.id}`,
    soapHref: buildPatientWorkspaceUrl(p.id, { tab: "soap", action: "nueva" }),
    rxHref: buildPatientWorkspaceUrl(p.id, { tab: "recetas", action: "nueva" }),
  }));
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}
