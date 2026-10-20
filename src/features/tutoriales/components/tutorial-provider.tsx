"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo } from "react";

import { TutorialOverlay } from "@/features/tutoriales/components/tutorial-overlay";
import {
  type TutorialEngineApi,
  useTutorialEngine,
} from "@/features/tutoriales/components/use-tutorial-engine";

const TutorialContext = createContext<TutorialEngineApi | null>(null);

interface TutorialProviderProps {
  children: React.ReactNode;
  organizationId?: string | null;
  userId?: string | null;
  permissions?: string[];
  enabled?: boolean;
}

export function TutorialProvider({
  children,
  organizationId,
  userId,
  permissions,
  enabled = true,
}: TutorialProviderProps) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  const engine = useTutorialEngine({
    organizationId,
    userId,
    permissions,
    pathname,
    navigate,
  });
  const value = useMemo(() => engine, [engine]);

  if (!enabled) return <>{children}</>;

  return (
    <TutorialContext.Provider value={value}>
      {children}
      <TutorialOverlay engine={value} />
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialEngineApi {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial debe usarse dentro de TutorialProvider");
  }
  return ctx;
}

export function useOptionalTutorial(): TutorialEngineApi | null {
  return useContext(TutorialContext);
}
