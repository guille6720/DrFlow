"use client";

import { type ReactNode, type RefObject, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { computeFloatingAnchorBox } from "@/core/browser/floating-anchor-box";

import { cn } from "@/shared/utils/cn";

type Props = {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  children: ReactNode;
  className?: string;
  preferredMaxHeight?: number;
  preferredMinWidth?: number;
};

export function FloatingAnchorPanel({
  anchorRef,
  open,
  children,
  className,
  preferredMaxHeight = 360,
  preferredMinWidth,
}: Props) {
  const [box, setBox] = useState<ReturnType<typeof computeFloatingAnchorBox> | null>(null);

  useLayoutEffect(() => {
    if (!open) return undefined;

    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setBox(
        computeFloatingAnchorBox(
          { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
          { width: window.innerWidth, height: window.innerHeight },
          preferredMaxHeight,
          4,
          preferredMinWidth
        )
      );
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, open, preferredMaxHeight, preferredMinWidth]);

  if (!open || !box || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn("overflow-y-auto", className)}
      style={{
        position: "fixed",
        top: box.top,
        left: box.left,
        width: box.width,
        maxHeight: box.maxHeight,
        zIndex: 200,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
