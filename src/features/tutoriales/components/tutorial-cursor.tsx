"use client";

import { cn } from "@/shared/utils/cn";

import { prefersReducedMotion } from "@/features/tutoriales/lib/prefers-reduced-motion";

interface TutorialCursorProps {
  rect: DOMRect | null;
  visible: boolean;
}

/** Illustrative cursor — never clicks or triggers business actions. */
export function TutorialCursor({ rect, visible }: TutorialCursorProps) {
  if (!visible || !rect) return null;
  const reduced = prefersReducedMotion();
  const x = rect.left + Math.min(rect.width * 0.65, rect.width - 8);
  const y = rect.top + Math.min(rect.height * 0.55, rect.height - 8);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[65]"
      style={{
        left: x,
        top: y,
        transform: "translate(-20%, -10%)",
        transition: reduced ? undefined : "left 400ms ease, top 400ms ease",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 3l12 7.5-5.2 1.6L9 20.5 4 3z"
          className="fill-[var(--primary)] stroke-white"
          strokeWidth="1.2"
        />
      </svg>
      <span
        className={cn(
          "absolute -left-1 -top-1 h-8 w-8 rounded-full border-2 border-[var(--primary)]/50",
          !reduced && "animate-ping"
        )}
      />
    </div>
  );
}
