"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildProgressPatch,
  readLocalTutorialProgress,
  writeLocalTutorialProgress,
} from "@/features/tutoriales/lib/local-progress";
import { prefersReducedMotion } from "@/features/tutoriales/lib/prefers-reduced-motion";
import {
  clearTutorialSession,
  readTutorialSession,
  writeTutorialSession,
} from "@/features/tutoriales/lib/tutorial-session";
import { isEditableKeyboardTarget, waitForTarget } from "@/features/tutoriales/lib/wait-for-target";
import { getTutorialById } from "@/features/tutoriales/registry";
import { resolveTutorialRoute } from "@/features/tutoriales/resolve-route";
import { tourSelector } from "@/features/tutoriales/targets";
import type {
  TutorialDefinition,
  TutorialMode,
  TutorialProgressStatus,
  TutorialStep,
} from "@/features/tutoriales/types";

export type TutorialGuidePhase = "intro" | "guide";

const INTRO_DURATION_MS = 1800;
const INTRO_DURATION_REDUCED_MS = 400;

export interface TutorialEngineState {
  tutorial: TutorialDefinition | null;
  stepIndex: number;
  step: TutorialStep | null;
  mode: TutorialMode;
  active: boolean;
  targetMissing: boolean;
  targetRect: DOMRect | null;
  paused: boolean;
  navigating: boolean;
  phase: TutorialGuidePhase;
}

export interface TutorialEngineApi {
  state: TutorialEngineState;
  start: (tutorialId: string, mode?: TutorialMode) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  skipIntro: () => void;
  syncStepFromNarration: (stepIndex: number) => void;
  completeFromNarration: () => void;
}

export interface UseTutorialEngineOptions {
  organizationId?: string | null;
  userId?: string | null;
  permissions?: string[];
  pathname?: string;
  navigate?: (href: string) => void;
  onComplete?: (tutorialId: string) => void;
}

function findTargetRect(target?: string): { rect: DOMRect | null; missing: boolean } {
  if (!target || typeof document === "undefined") {
    return { rect: null, missing: Boolean(target) };
  }
  const el = document.querySelector(tourSelector(target));
  if (!el) return { rect: null, missing: true };
  el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  return { rect: el.getBoundingClientRect(), missing: false };
}

export function useTutorialEngine(options: UseTutorialEngineOptions = {}): TutorialEngineApi {
  const {
    organizationId,
    userId,
    permissions = [],
    pathname = "/",
    navigate,
    onComplete,
  } = options;

  const [tutorialId, setTutorialId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<TutorialMode>("demo");
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [phase, setPhase] = useState<TutorialGuidePhase>("intro");

  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const navSeqRef = useRef(0);

  const clearIntroTimer = () => {
    if (introTimerRef.current) {
      clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }
  };

  const tutorial = useMemo(
    () => (tutorialId ? getTutorialById(tutorialId) : null),
    [tutorialId]
  );
  const step = tutorial?.steps[stepIndex] ?? null;

  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions]
  );

  const persist = useCallback(
    (nextIndex: number, status: TutorialProgressStatus) => {
      if (!tutorial || !organizationId || !userId) return;
      const previous = readLocalTutorialProgress(organizationId, userId, tutorial.id);
      const patch = buildProgressPatch({
        tutorialId: tutorial.id,
        tutorialVersion: tutorial.version,
        currentStepIndex: nextIndex,
        status,
        previous,
      });
      writeLocalTutorialProgress(organizationId, userId, patch);
      if (status === "in_progress") {
        writeTutorialSession({
          tutorialId: tutorial.id,
          mode,
          stepIndex: nextIndex,
          organizationId,
          userId,
          updatedAt: new Date().toISOString(),
        });
      } else {
        clearTutorialSession();
      }
    },
    [tutorial, organizationId, userId, mode]
  );

  const measureTarget = useCallback(async () => {
    if (!step || navigating) {
      if (!step) {
        setTargetRect(null);
        setTargetMissing(false);
      }
      return;
    }
    if (
      step.validation?.requirePermission &&
      !permissions.includes(step.validation.requirePermission)
    ) {
      setTargetRect(null);
      setTargetMissing(true);
      return;
    }
    const waited = await waitForTarget(step.target, { timeoutMs: 2200 });
    if (waited.missing) {
      const { rect, missing } = findTargetRect(step.target);
      setTargetRect(rect);
      setTargetMissing(missing);
      return;
    }
    setTargetRect(waited.rect);
    setTargetMissing(false);
  }, [step, permissions, navigating]);

  const syncRouteForStep = useCallback(
    async (def: TutorialDefinition, nextStep: TutorialStep) => {
      const decision = resolveTutorialRoute({
        tutorial: def,
        step: nextStep,
        pathname,
        hasPermission,
      });

      if (decision.kind === "blocked-permission") {
        setTargetRect(null);
        setTargetMissing(true);
        return;
      }
      if (decision.kind === "navigate" && navigate) {
        const seq = ++navSeqRef.current;
        setNavigating(true);
        navigate(decision.href);
        // Wait briefly for route; measureTarget will run on pathname change.
        window.setTimeout(() => {
          if (seq === navSeqRef.current) setNavigating(false);
        }, 600);
      }
    },
    [pathname, hasPermission, navigate]
  );

  const finish = useCallback(
    (status: TutorialProgressStatus) => {
      clearIntroTimer();
      if (tutorial) persist(stepIndex, status);
      setActive(false);
      setPaused(false);
      setTutorialId(null);
      setTargetRect(null);
      setTargetMissing(false);
      setPhase("intro");
      clearTutorialSession();
      if (status === "completed" && tutorial) onComplete?.(tutorial.id);
    },
    [tutorial, stepIndex, persist, onComplete]
  );

  const start = useCallback(
    (id: string, nextMode: TutorialMode = "demo") => {
      const def = getTutorialById(id);
      if (!def) return;
      clearIntroTimer();
      setTutorialId(id);
      setStepIndex(0);
      setMode(nextMode);
      setActive(true);
      setPaused(false);
      setPhase("intro");
      setNavigating(false);
      persist(0, "in_progress");
      void syncRouteForStep(def, def.steps[0]!);
      const introMs = prefersReducedMotion() ? INTRO_DURATION_REDUCED_MS : INTRO_DURATION_MS;
      introTimerRef.current = setTimeout(() => {
        setPhase("guide");
        introTimerRef.current = null;
      }, introMs);
    },
    [persist, syncRouteForStep]
  );

  const skipIntro = useCallback(() => {
    clearIntroTimer();
    setPhase("guide");
  }, []);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  const skip = useCallback(() => {
    finish("skipped");
  }, [finish]);

  const syncStepFromNarration = useCallback(
    (nextIndex: number) => {
      if (!tutorial || !active) return;
      const clamped = Math.max(0, Math.min(nextIndex, tutorial.steps.length - 1));
      setStepIndex(clamped);
      persist(clamped, "in_progress");
      const nextStep = tutorial.steps[clamped];
      if (nextStep) void syncRouteForStep(tutorial, nextStep);
    },
    [tutorial, active, persist, syncRouteForStep]
  );

  const completeFromNarration = useCallback(() => {
    finish("completed");
  }, [finish]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void measureTarget();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [measureTarget, stepIndex, pathname, phase]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        skip();
        return;
      }
      if (isEditableKeyboardTarget(event.target)) return;
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, skip]);

  useEffect(() => {
    if (!active || !step?.target) return;
    const onResize = () => {
      const { rect, missing } = findTargetRect(step.target);
      setTargetRect(rect);
      setTargetMissing(missing);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, step?.target]);

  // Restore in-progress session after navigation (provider survives route changes).
  useEffect(() => {
    if (restoredRef.current || active || !organizationId || !userId) return;
    restoredRef.current = true;
    const session = readTutorialSession();
    if (!session) return;
    if (session.organizationId !== organizationId || session.userId !== userId) {
      clearTutorialSession();
      return;
    }
    const def = getTutorialById(session.tutorialId);
    if (!def) {
      clearTutorialSession();
      return;
    }
    const timer = window.setTimeout(() => {
      setTutorialId(session.tutorialId);
      setMode(session.mode);
      setStepIndex(session.stepIndex);
      setActive(true);
      setPhase("guide");
      setPaused(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [organizationId, userId, active]);

  useEffect(() => () => clearIntroTimer(), []);

  const state: TutorialEngineState = {
    tutorial,
    stepIndex,
    step,
    mode,
    active,
    targetMissing,
    targetRect,
    paused,
    navigating,
    phase,
  };

  return {
    state,
    start,
    pause,
    resume,
    skip,
    skipIntro,
    syncStepFromNarration,
    completeFromNarration,
  };
}
