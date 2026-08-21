import Link from "next/link";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "drflow-btn-primary bg-[var(--primary)] text-[var(--text-on-primary,var(--primary-foreground))] hover:bg-[var(--primary-dark)] active:brightness-95 focus-visible:ring-[var(--ring)] shadow-sm",
  secondary:
    "drflow-btn-secondary bg-[var(--secondary)] text-[var(--text-on-secondary,var(--secondary-foreground))] border border-[var(--border-strong,var(--border))] hover:bg-[var(--surface-hover,var(--muted))] active:bg-[var(--surface-hover,var(--muted))] focus-visible:ring-[var(--ring)]",
  outline:
    "drflow-btn-outline border border-[var(--border-default,var(--border))] bg-[var(--surface-card,var(--card))] text-[var(--text-on-card,var(--foreground))] hover:bg-[var(--surface-hover,var(--muted))] active:bg-[var(--surface-hover,var(--muted))] focus-visible:ring-[var(--ring)]",
  ghost:
    "drflow-btn-ghost text-[var(--text-primary,var(--foreground))] hover:bg-[var(--surface-hover,var(--muted))] hover:text-[var(--text-primary,var(--foreground))] active:bg-[var(--surface-hover,var(--muted))] focus-visible:ring-[var(--ring)]",
  danger:
    "drflow-btn-danger bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:brightness-95 active:brightness-90 focus-visible:ring-[var(--destructive)]",
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
          "disabled:cursor-not-allowed disabled:opacity-100",
          busy && "drflow-btn-loading",
          className
        )}
        {...props}
      >
        {busy && (
          <span
            className="drflow-btn-spinner h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
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
