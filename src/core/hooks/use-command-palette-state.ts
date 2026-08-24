"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useEntitlementsSnapshot } from "@/core/components/entitlements/entitlements-provider";
import { useCommandPaletteKeyboard } from "@/core/hooks/use-command-palette-keyboard";
import { useCommandPalettePatientSearch } from "@/core/hooks/use-command-palette-patient-search";
import type { PermissionOverrides } from "@/core/permissions/roles";

import {
  buildPatientContextPaletteActions,
  COMMAND_PALETTE_ACTIONS,
  COMMAND_PALETTE_NAV,
} from "@/lib/constants/command-palette-items";
import { parsePatientIdFromPath } from "@/lib/utils/clinical-workflow-context";
import { filterCommandPaletteItems } from "@/lib/utils/command-palette-search";
import type { UserRole } from "@/types/database";

type Options = {
  role: UserRole | null;
  isSuperadmin?: boolean;
  permissionOverrides?: PermissionOverrides;
  enabled?: boolean;
};

export function useCommandPaletteState({
  role,
  isSuperadmin = false,
  permissionOverrides,
  enabled = true,
}: Options) {
  const router = useRouter();
  const pathname = usePathname();
  const entitlements = useEntitlementsSnapshot();
  const activePatientId = parsePatientIdFromPath(pathname);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { patientHits, loadingPatients, setPatientHits } = useCommandPalettePatientSearch(
    open,
    query
  );

  const staticItems = useMemo(() => {
    const ctx = activePatientId
      ? filterCommandPaletteItems(
          buildPatientContextPaletteActions(activePatientId),
          query,
          role,
          isSuperadmin,
          permissionOverrides,
          entitlements
        )
      : [];
    const actions = filterCommandPaletteItems(
      COMMAND_PALETTE_ACTIONS,
      query,
      role,
      isSuperadmin,
      permissionOverrides,
      entitlements
    );
    const nav = filterCommandPaletteItems(
      COMMAND_PALETTE_NAV,
      query,
      role,
      isSuperadmin,
      permissionOverrides,
      entitlements
    );
    return [...ctx, ...actions, ...nav];
  }, [activePatientId, query, role, isSuperadmin, permissionOverrides, entitlements]);

  const flatResults = useMemo(
    () => [
      ...staticItems.map((item) => ({ kind: "static" as const, item })),
      ...patientHits.map((patient) => ({ kind: "patient" as const, patient })),
    ],
    [staticItems, patientHits]
  );

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      setPatientHits([]);
      setSelectedIndex(0);
      router.push(href);
    },
    [router, setPatientHits]
  );

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setSelectedIndex(0));
    return () => cancelAnimationFrame(frame);
  }, [open, query, patientHits.length, staticItems.length]);

  useCommandPaletteKeyboard({
    enabled,
    open,
    setOpen,
    flatResults,
    selectedIndex,
    setSelectedIndex,
    navigate,
    activePatientId,
  });

  return {
    open: enabled ? open : false,
    setOpen: enabled ? setOpen : () => {},
    toggle: enabled ? toggle : () => {},
    query,
    setQuery,
    staticItems,
    patientHits,
    loadingPatients,
    selectedIndex,
    setSelectedIndex,
    navigate,
    flatResults,
  };
}
