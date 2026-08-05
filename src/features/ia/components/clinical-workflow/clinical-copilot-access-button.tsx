"use client";

import { Sparkles } from "lucide-react";
import type { ComponentProps } from "react";

import { useClinicalCopilot } from "@/features/ia/components/clinical-workflow/clinical-copilot-context";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

import { Button } from "@/components/ui/button";
import type { ClinicalCopilotContext } from "@/lib/utils/clinical-copilot";

type ButtonProps = ComponentProps<typeof Button>;

type Props = Omit<ButtonProps, "onClick" | "type"> & {
  label?: string;
  /** Patient/context to load before opening the sheet. */
  context?: ClinicalCopilotContext;
  /** Replace session (default) or merge with existing copilot session. */
  mergeSession?: boolean;
};

/** Opens the conversational clinical copilot from any workflow surface. */
export function ClinicalCopilotAccessButton({
  label = "Asistente IA",
  context,
  mergeSession = false,
  variant = "outline",
  size = "sm",
  className,
  children,
  ...buttonProps
}: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  const { session, setSession, setOpen } = useClinicalCopilot();

  if (!enabled) return null;

  function handleOpen() {
    if (context) {
      setSession(mergeSession ? { ...session, ...context } : context);
    }
    setOpen(true);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleOpen}
      {...buttonProps}
    >
      {children ?? (
        <>
          <Sparkles className="h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  );
}
