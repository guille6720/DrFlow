import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const heights: Record<LogoSize, number> = {
  xs: 40,
  sm: 52,
  md: 68,
  lg: 88,
  xl: 108,
};

interface DrFlowLogoProps {
  size?: LogoSize;
  className?: string;
  href?: string | null;
  priority?: boolean;
  centered?: boolean;
}

/** Logo oficial DrFlow (PNG fondo transparente). */
export function DrFlowLogo({
  size = "md",
  className,
  href = "/",
  priority = false,
  centered = false,
}: DrFlowLogoProps) {
  const height = heights[size];
  const width = Math.round(height * 1.05);

  const image = (
    <Image
      src="/drflow-logo.png"
      alt="DrFlow"
      width={width}
      height={height}
      priority={priority}
      className={cn(
        "h-auto w-auto object-contain rounded-2xl",
        className
      )}
      style={{ height, width: "auto", maxWidth: "100%" }}
    />
  );

  const wrapperClass = cn(
    "inline-flex shrink-0 items-center",
    centered && "mx-auto w-full justify-center"
  );

  if (href) {
    return (
      <Link href={href} className={wrapperClass}>
        {image}
      </Link>
    );
  }

  return <div className={wrapperClass}>{image}</div>;
}
