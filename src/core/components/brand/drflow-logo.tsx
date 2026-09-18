import { NexClinicLogo } from "@/core/components/brand/nexclinic-logo";

export { NexClinicLogo } from "@/core/components/brand/nexclinic-logo";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

interface BrandLogoProps {
  size?: LogoSize;
  className?: string;
  href?: string | null;
  priority?: boolean;
  centered?: boolean;
  withTagline?: boolean;
  markOnly?: boolean;
  variant?: "color" | "mono" | "onDark";
}

/**
 * Logo público NexClinic.
 * El nombre de export `DrFlowLogo` se mantiene para no romper imports existentes.
 */
export function DrFlowLogo(props: BrandLogoProps) {
  return <NexClinicLogo {...props} />;
}
