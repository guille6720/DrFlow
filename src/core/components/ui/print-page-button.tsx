"use client";

import { Printer } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { runBrowserPrintWithFilename } from "@/core/browser/print-suggested-filename";

import { cn } from "@/shared/utils/cn";

import { Button } from "@/components/ui/button";
import { clinicalHistoryPrintTitle } from "@/lib/utils/clinical-history-filename";

type PrintFilenamePatient = {
  last_name: string;
  first_name: string;
  document_number?: string | null;
};

type Props = {
  label?: string;
  className?: string;
  variant?: "button" | "link";
  iconClassName?: string;
  children?: ReactNode;
  /** Suggested Save-as-PDF filename (without .pdf). */
  documentTitle?: string;
  /** Builds name + date + time at click for clinical history print. */
  printFilenamePatient?: PrintFilenamePatient;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

/** Triggers the browser print dialog for the current page. */
export function PrintPageButton({
  label = "Imprimir",
  className,
  variant = "button",
  iconClassName,
  children,
  type = "button",
  documentTitle,
  printFilenamePatient,
}: Props) {
  function handlePrint() {
    const title = printFilenamePatient
      ? clinicalHistoryPrintTitle({
          last_name: printFilenamePatient.last_name,
          first_name: printFilenamePatient.first_name,
          document_number: printFilenamePatient.document_number ?? undefined,
        })
      : documentTitle;
    if (title) {
      runBrowserPrintWithFilename(title, () => window.print());
      return;
    }
    window.print();
  }

  if (variant === "link") {
    return (
      <button
        type={type}
        onClick={handlePrint}
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
    <button type={type} onClick={handlePrint} className={cn("inline-flex print:hidden", className)}>
      {children ?? (
        <Button size="sm" variant="ghost" type="button">
          <Printer className="h-4 w-4" aria-hidden />
          {label}
        </Button>
      )}
    </button>
  );
}
