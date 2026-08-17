import Link from "next/link";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600 focus-visible:ring-teal-500 shadow-md shadow-cyan-500/25",
  secondary: "bg-teal-50 text-teal-900 hover:bg-teal-100 focus-visible:ring-teal-400",
  outline:
    "border border-slate-200 bg-white text-slate-800 hover:bg-teal-50 hover:border-teal-200",
  ghost: "text-slate-700 hover:bg-teal-50 hover:text-teal-900",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 py-2 text-sm",
  md: "min-h-11 px-4 py-2.5 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

/** Shared button surface classes (WCAG 2.2 touch target ≥44px). */
export function buttonSurfaceClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
): string {
  return cn(
    "drflow-ui-button inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    variants[variant],
    sizes[size],
    className
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Replaces children while `loading` so the click feels instant (<100 ms). */
  pendingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      pendingLabel,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const busy = Boolean(loading);
    return (
      <button
        ref={ref}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={cn(
          buttonSurfaceClassName(variant, size),
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {busy && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {busy && pendingLabel ? pendingLabel : children}
      </button>
    );
  }
);

Button.displayName = "Button";

type ButtonLinkProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
  prefetch?: boolean;
  title?: string;
  "aria-label"?: string;
};

/** Accessible link styled as button — avoids nested interactive elements. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  prefetch = true,
  title,
  "aria-label": ariaLabel,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      title={title}
      aria-label={ariaLabel}
      className={buttonSurfaceClassName(variant, size, className)}
    >
      {children}
    </Link>
  );
}
