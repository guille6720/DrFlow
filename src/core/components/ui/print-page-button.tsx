"use client";

import { Printer } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

import { Button } from "@/components/ui/button";

type Props = {
  label?: string;
  className?: string;
  variant?: "button" | "link";
  iconClassName?: string;
  children?: ReactNode;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

/** Triggers the browser print dialog for the current page. */
export function PrintPageButton({
  label = "Imprimir",
  className,
  variant = "button",
  iconClassName,
  children,
  type = "button",
}: Props) {
  if (variant === "link") {
    return (
      <button
        type={type}
        onClick={() => window.print()}
        className={cn("print:hidden", className)}
      >
        {children ?? (
          <>
            <Printer className={cn("h-3.5 w-3.5", iconClassName)} aria-hidden />
            {label}
          </>
        )}
      </button>
    );
  }

  return (
    <button type={type} onClick={() => window.print()} className={cn("inline-flex print:hidden", className)}>
      {children ?? (
        <Button size="sm" variant="ghost" type="button">
          <Printer className="h-4 w-4" aria-hidden />
          {label}
        </Button>
      )}
    </button>
  );
}
