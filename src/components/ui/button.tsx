import Link from "next/link";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground,#ffffff)] hover:bg-[var(--primary-hover,var(--primary-dark))] focus-visible:ring-[var(--primary)] shadow-md shadow-[color-mix(in_srgb,var(--primary)_22%,transparent)]",
  secondary:
    "bg-[var(--primary-soft,#ccfbf1)] text-[var(--primary-hover,#134e4a)] hover:brightness-95 focus-visible:ring-[var(--primary)]",
  outline:
    "border border-[var(--border,#e2e8f0)] bg-[var(--surface,#ffffff)] text-[var(--text-primary,#0f172a)] hover:bg-[var(--primary-soft,#f0fdfa)] hover:border-[var(--border-strong,var(--border))]",
  ghost:
    "text-[var(--text-secondary,#334155)] hover:bg-[var(--primary-soft,#f0fdfa)] hover:text-[var(--primary-hover,#134e4a)]",
  danger: "bg-[var(--error,#dc2626)] text-white hover:brightness-95 focus-visible:ring-[var(--error,#dc2626)]",
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
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          buttonSurfaceClassName(variant, size),
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
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
  "aria-label"?: string;
};

/** Accessible link styled as button — avoids nested interactive elements. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  prefetch,
  "aria-label": ariaLabel,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-label={ariaLabel}
      className={buttonSurfaceClassName(variant, size, className)}
    >
      {children}
    </Link>
  );
}
