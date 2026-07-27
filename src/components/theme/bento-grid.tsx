import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type Span = 3 | 4 | 6 | 8 | 12;

const spanClass: Record<Span, string> = {
  3: "drflow-bento-span-3",
  4: "drflow-bento-span-4",
  6: "drflow-bento-span-6",
  8: "drflow-bento-span-8",
  12: "drflow-bento-span-12",
};

export function BentoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("drflow-bento", className)}>{children}</div>;
}

export function BentoCell({
  children,
  span = 12,
  className,
}: {
  children: ReactNode;
  span?: Span;
  className?: string;
}) {
  return (
    <div className={cn("drflow-bento-cell min-w-0", spanClass[span], className)}>{children}</div>
  );
}
