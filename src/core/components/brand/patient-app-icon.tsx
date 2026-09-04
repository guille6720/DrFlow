import Image from "next/image";

import {
  brandIconSizes,
  resolvePatientAppIconSrc,
} from "@/core/components/brand/brand-image-utils";

import { cn } from "@/shared/utils/cn";

type IconSize = "sm" | "md" | "lg";

const sizes: Record<IconSize, number> = {
  sm: 64,
  md: 96,
  lg: 128,
};

interface PatientAppIconProps {
  size?: IconSize;
  className?: string;
  priority?: boolean;
}

/** Icono verde que queda en la pantalla de inicio del paciente. */
export function PatientAppIcon({
  size = "md",
  className,
  priority = false,
}: PatientAppIconProps) {
  const px = sizes[size];
  const src = resolvePatientAppIconSrc(px);

  return (
    <Image
      src={src}
      alt="NexClinic — App para pacientes"
      width={px}
      height={px}
      sizes={brandIconSizes(px)}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      className={cn("rounded-[22%] shadow-lg", className)}
    />
  );
}
