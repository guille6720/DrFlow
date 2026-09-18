import { BRAND_COLORS } from "@/core/brand/brand";

import { cn } from "@/shared/utils/cn";

type MarkVariant = "color" | "mono" | "onDark";

const GRADIENT_ID = "nexclinic-mark-grad";

/** Isotipo NexClinic: cruz médica + barras + check (SVG). */
export function NexClinicMark({
  className,
  variant = "color",
  title = "NexClinic",
}: {
  className?: string;
  variant?: MarkVariant;
  title?: string;
}) {
  const fill =
    variant === "mono"
      ? BRAND_COLORS.navy
      : variant === "onDark"
        ? BRAND_COLORS.white
        : `url(#${GRADIENT_ID})`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {variant === "color" ? (
        <defs>
          <linearGradient id={GRADIENT_ID} x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={BRAND_COLORS.navy} />
            <stop offset="35%" stopColor={BRAND_COLORS.blue} />
            <stop offset="70%" stopColor={BRAND_COLORS.turquoise} />
            <stop offset="100%" stopColor={BRAND_COLORS.green} />
          </linearGradient>
        </defs>
      ) : null}
      {/* Rounded medical cross */}
      <path
        fill={fill}
        d="M26 8c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4v14h14c2.2 0 4 1.8 4 4v4c0 2.2-1.8 4-4 4H38v14c0 2.2-1.8 4-4 4h-4c-2.2 0-4-1.8-4-4V34H12c-2.2 0-4-1.8-4-4v-4c0-2.2 1.8-4 4-4h14V8z"
      />
      {/* Chart bars (knockout via contrast fill on color; solid on mono) */}
      {variant === "color" ? (
        <>
          <rect x="18" y="40" width="5" height="8" rx="1.2" fill="#E8F7F4" opacity="0.95" />
          <rect x="25" y="35" width="5" height="13" rx="1.2" fill="#E8F7F4" opacity="0.95" />
          <rect x="32" y="30" width="5" height="18" rx="1.2" fill="#E8F7F4" opacity="0.95" />
          <path
            d="M16.5 44.5c2.2-1.2 4.5-5.2 7.2-9.8 2.4-4 5.2-7.6 8.8-8.6 2.6-.7 5.4.3 8.2 2.6"
            fill="none"
            stroke="#E8F7F4"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.98"
          />
        </>
      ) : (
        <>
          <rect x="18" y="40" width="5" height="8" rx="1.2" fill={variant === "onDark" ? BRAND_COLORS.navy : "#F8FAFC"} />
          <rect x="25" y="35" width="5" height="13" rx="1.2" fill={variant === "onDark" ? BRAND_COLORS.navy : "#F8FAFC"} />
          <rect x="32" y="30" width="5" height="18" rx="1.2" fill={variant === "onDark" ? BRAND_COLORS.navy : "#F8FAFC"} />
          <path
            d="M16.5 44.5c2.2-1.2 4.5-5.2 7.2-9.8 2.4-4 5.2-7.6 8.8-8.6 2.6-.7 5.4.3 8.2 2.6"
            fill="none"
            stroke={variant === "onDark" ? BRAND_COLORS.navy : "#F8FAFC"}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
