import {
  hasPermission,
  MANAGEABLE_PERMISSION_KEYS,
  type PermissionKey,
  type PermissionOverrides,
} from "@/core/permissions/roles";

import type { UserRole } from "@/types/database";

/** Flat list of granted permission keys for tutorial step gates. */
export function listGrantedPermissionKeys(
  role: UserRole | null,
  isSuperadmin: boolean,
  overrides?: PermissionOverrides
): string[] {
  const keys = Object.keys(
    // Include manageable keys + a few used by tutorials that may not be in MANAGEABLE.
    {
      ...Object.fromEntries(MANAGEABLE_PERMISSION_KEYS.map((k) => [k, true])),
      manageSettings: true,
    }
  ) as PermissionKey[];

  return keys.filter((key) => hasPermission(role, key, isSuperadmin, overrides));
}
