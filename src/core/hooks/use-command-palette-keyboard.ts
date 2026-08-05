"use client";

import { useEffect } from "react";

import { isEditableTarget } from "@/lib/utils/command-palette-search";

type FlatResult =
  | { kind: "static"; item: { href: string } }
  | { kind: "patient"; patient: { href: string } };

type Options = {
  enabled: boolean;
  open: boolean;
  setOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  flatResults: FlatResult[];
  selectedIndex: number;
  setSelectedIndex: (v: number | ((prev: number) => number)) => void;
  navigate: (href: string) => void;
  activePatientId: string | null;
};

export function useCommandPaletteKeyboard({
  enabled,
  open,
  setOpen,
  flatResults,
  selectedIndex,
  setSelectedIndex,
  navigate,
  activePatientId,
}: Options) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target) && !open) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === "n" && !activePatientId) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, Math.max(flatResults.length - 1, 0)));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === "Enter" && flatResults.length > 0) {
        e.preventDefault();
        const hit = flatResults[selectedIndex];
        if (!hit) return;
        if (hit.kind === "static") navigate(hit.item.href);
        else navigate(hit.patient.href);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    enabled,
    open,
    flatResults,
    selectedIndex,
    navigate,
    activePatientId,
    setOpen,
    setSelectedIndex,
  ]);
}
