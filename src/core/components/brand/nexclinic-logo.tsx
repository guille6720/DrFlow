import Link from "next/link";

import { BRAND_COLORS, BRAND_NAME, BRAND_TAGLINE } from "@/core/brand/brand";
import { NexClinicMark } from "@/core/components/brand/nexclinic-mark";

import { cn } from "@/shared/utils/cn";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const heights: Record<LogoSize, number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 56,
  xl: 72,
};

type LogoVariant = "color" | "mono" | "onDark";

interface NexClinicLogoProps {
  size?: LogoSize;
  className?: string;
  href?: string | null;
  /** Show tagline under wordmark (landing / auth). */
  withTagline?: boolean;
  /** Icon-only lockup. */
  markOnly?: boolean;
  variant?: LogoVariant;
  centered?: boolean;
  /** Kept for API parity with the old Image-based logo. */
  priority?: boolean;
}

/** Logo horizontal NexClinic (SVG). */
export function NexClinicLogo({
  size = "md",
  className,
  href = "/",
  withTagline = false,
  markOnly = false,
  variant = "color",
  centered = false,
}: NexClinicLogoProps) {
  const markSize = heights[size];
  const onDark = variant === "onDark";
  const mono = variant === "mono";

  const wordmark = !markOnly ? (
    <span className="flex min-w-0 flex-col leading-none">
      <span
        className={cn(
          "font-semibold tracking-tight",
          size === "xs" || size === "sm" ? "text-base" : size === "md" ? "text-lg" : "text-2xl"
        )}
        style={mono || onDark ? { color: onDark ? BRAND_COLORS.white : BRAND_COLORS.navy } : undefined}
      >
        {mono || onDark ? (
          BRAND_NAME
        ) : (
          <>
            <span style={{ color: BRAND_COLORS.navy }}>Nex</span>
            <span
              style={{
                backgroundImage: `linear-gradient(90deg, ${BRAND_COLORS.turquoise}, ${BRAND_COLORS.green})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Clinic
            </span>
          </>
        )}
      </span>
      {withTagline ? (
        <span
          className="mt-1 text-[9px] font-medium uppercase tracking-[0.18em] sm:text-[10px]"
          style={{ color: onDark ? "#94A3B8" : BRAND_COLORS.gray }}
        >
          {BRAND_TAGLINE}
        </span>
      ) : null}
    </span>
  ) : null;

  const styled = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span style={{ width: markSize, height: markSize }} className="shrink-0">
        <NexClinicMark className="h-full w-full" variant={variant} />
      </span>
      {wordmark}
    </span>
  );

  const wrapperClass = cn(
    "inline-flex shrink-0 items-center",
    centered && "mx-auto w-full justify-center"
  );

  if (href) {
    return (
      <Link href={href} className={wrapperClass} aria-label={BRAND_NAME}>
        {styled}
      </Link>
    );
  }

  return <div className={wrapperClass}>{styled}</div>;
}

/** @deprecated Use NexClinicLogo — kept so existing imports keep compiling during rebrand. */
export const DrFlowLogo = NexClinicLogo;
