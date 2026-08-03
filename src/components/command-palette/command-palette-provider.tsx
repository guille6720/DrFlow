"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/database";
import {
  COMMAND_PALETTE_ACTIONS,
  COMMAND_PALETTE_NAV,
} from "@/lib/constants/command-palette-items";
import {
  filterCommandPaletteItems,
  isEditableTarget,
  type CommandPalettePatientHit,
} from "@/lib/utils/command-palette-search";
import { CommandPaletteDialog } from "@/components/command-palette/command-palette-dialog";

type CommandPaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    return {
      open: false,
      setOpen: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
  role: UserRole | null;
  isSuperadmin?: boolean;
  enabled?: boolean;
};

export function CommandPaletteProvider({
  children,
  role,
  isSuperadmin = false,
  enabled = true,
}: ProviderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [patientHits, setPatientHits] = useState<CommandPalettePatientHit[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const staticItems = useMemo(() => {
    const actions = filterCommandPaletteItems(COMMAND_PALETTE_ACTIONS, query, role, isSuperadmin);
    const nav = filterCommandPaletteItems(COMMAND_PALETTE_NAV, query, role, isSuperadmin);
    return [...actions, ...nav];
  }, [query, role, isSuperadmin]);

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
    [router]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedIndex(0);
  }, [open, query, patientHits.length, staticItems.length]);

  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    if (q.length < 2) {
      setPatientHits([]);
      setLoadingPatients(false);
      return;
    }

    if (fetchRef.current) clearTimeout(fetchRef.current);
    setLoadingPatients(true);
    fetchRef.current = setTimeout(() => {
      void fetch(`/api/command-palette/patients?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { patients: [] }))
        .then((data: { patients?: CommandPalettePatientHit[] }) => {
          setPatientHits(data.patients ?? []);
        })
        .catch(() => setPatientHits([]))
        .finally(() => setLoadingPatients(false));
    }, 200);

    return () => {
      if (fetchRef.current) clearTimeout(fetchRef.current);
    };
  }, [open, query]);

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

      if (mod && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push("/historias/nueva");
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
  }, [enabled, open, flatResults, selectedIndex, navigate, router]);

  return (
    <CommandPaletteContext.Provider
      value={{ open: enabled ? open : false, setOpen: enabled ? setOpen : () => {}, toggle: enabled ? toggle : () => {} }}
    >
      {children}
      {enabled ? (
      <CommandPaletteDialog
        open={open}
        query={query}
        onQueryChange={setQuery}
        onClose={() => setOpen(false)}
        staticItems={staticItems}
        patientHits={patientHits}
        loadingPatients={loadingPatients}
        selectedIndex={selectedIndex}
        onSelectIndex={setSelectedIndex}
        onNavigate={navigate}
        flatResults={flatResults}
      />
      ) : null}
    </CommandPaletteContext.Provider>
  );
}
