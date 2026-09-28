import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  computeOverrideOnToggle,
  getEffectivePermissionsForRole,
  MANAGEABLE_PERMISSION_KEYS,
} from "@/core/permissions/member-permissions";
import {
  buildRoleChanges,
  buildRoleOverrides,
  groupState,
  mergePermissionOverrides,
  PERMISSION_GROUPS,
  roleEffective,
} from "@/core/permissions/role-permissions";
import { hasPermission, PERMISSIONS } from "@/core/permissions/roles";

describe("role permissions layer", () => {
  it("groups cover every manageable permission exactly once", () => {
    const keys = PERMISSION_GROUPS.flatMap((g) => g.keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...MANAGEABLE_PERMISSION_KEYS].sort());
  });

  it("without role rows the effective permissions equal today's code defaults", () => {
    for (const role of ["doctor", "secretary"] as const) {
      const effective = getEffectivePermissionsForRole(role, undefined, {});
      for (const key of MANAGEABLE_PERMISSION_KEYS) {
        expect(effective[key]).toBe(PERMISSIONS[key].includes(role));
      }
    }
  });

  it("precedence: member exception > clinic role setting > code default", () => {
    const roleOverrides = buildRoleOverrides([
      { role: "secretary", permission_key: "viewReports", granted: true },
      { role: "secretary", permission_key: "managePayments", granted: false },
    ]);
    expect(roleEffective("secretary", "viewReports", roleOverrides)).toBe(true);
    const merged = mergePermissionOverrides("secretary", roleOverrides, { viewReports: false });
    expect(hasPermission("secretary", "viewReports", false, merged)).toBe(false);
    expect(hasPermission("secretary", "managePayments", false, merged)).toBe(false);
    expect(hasPermission("secretary", "manageAppointments", false, merged)).toBe(
      PERMISSIONS.manageAppointments.includes("secretary")
    );
  });

  it("role rows never affect clinic_admin, patient or another role", () => {
    const roleOverrides = buildRoleOverrides([
      { role: "doctor", permission_key: "viewReports", granted: false },
      { role: "clinic_admin", permission_key: "viewReports", granted: false },
      { role: "patient", permission_key: "viewReports", granted: true },
      { role: "doctor", permission_key: "notARealKey", granted: true },
    ]);
    expect(roleOverrides).toEqual({ doctor: { viewReports: false } });
    expect(mergePermissionOverrides("clinic_admin", roleOverrides, null)).toEqual({});
    expect(mergePermissionOverrides("secretary", roleOverrides, null)).toEqual({});
  });

  it("changes equal to the code default are sent as null (row removed)", () => {
    const secretaryDefault = PERMISSIONS.viewReports.includes("secretary");
    const changes = buildRoleChanges("secretary", ["viewReports", "bogus"], secretaryDefault);
    expect(changes).toEqual({ viewReports: null });
    expect(buildRoleChanges("secretary", ["viewReports"], !secretaryDefault)).toEqual({
      viewReports: !secretaryDefault,
    });
  });

  it("group tri-state reflects the role values", () => {
    const group = PERMISSION_GROUPS.find((g) => g.id === "agenda")!;
    const all = buildRoleOverrides(
      group.keys.map((k) => ({ role: "doctor", permission_key: k, granted: true }))
    );
    expect(groupState("doctor", group, all)).toBe("all");
    const none = buildRoleOverrides(
      group.keys.map((k) => ({ role: "doctor", permission_key: k, granted: false }))
    );
    expect(groupState("doctor", group, none)).toBe("none");
    const some = buildRoleOverrides([
      { role: "doctor", permission_key: group.keys[0], granted: true },
      { role: "doctor", permission_key: group.keys[1], granted: false },
    ]);
    expect(groupState("doctor", group, some)).toBe("some");
  });

  it("member toggles are computed against the clinic role baseline", () => {
    const roleOverrides = buildRoleOverrides([
      { role: "secretary", permission_key: "viewReports", granted: true },
    ]);
    expect(computeOverrideOnToggle("secretary", "viewReports", true, roleOverrides)).toBeNull();
    expect(computeOverrideOnToggle("secretary", "viewReports", false, roleOverrides)).toBe(false);
  });
});

describe("clinic_role_permissions migration", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260928203000_clinic_role_permissions.sql"),
    "utf8"
  );

  it("enables RLS and only allows SELECT to authenticated", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/REVOKE ALL ON (TABLE )?public\.clinic_role_permissions FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/GRANT SELECT ON (TABLE )?public\.clinic_role_permissions TO authenticated/i);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*clinic_role_permissions TO authenticated/i);
  });

  it("RPC is SECURITY DEFINER, checks clinic admin and writes audit", () => {
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = public/i);
    expect(sql).toMatch(/user_role_in_clinic\(p_clinic_id\)/);
    expect(sql).toMatch(/FORBIDDEN/);
    expect(sql).toMatch(/INSERT INTO public\.audit_logs/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.set_clinic_role_permissions[^;]*FROM PUBLIC, anon/i);
  });
});
