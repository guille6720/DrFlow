import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { PATIENT_PWA_ICON_512 } from "@/lib/utils/patient-portal-ready";

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

  return (
    <Image
      src={PATIENT_PWA_ICON_512}
      alt="DrFlow — App para pacientes"
      width={px}
      height={px}
      priority={priority}
      className={cn("rounded-[22%] shadow-lg", className)}
    />
  );
}
