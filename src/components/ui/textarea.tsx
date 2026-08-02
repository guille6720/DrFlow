"use client";

import { cn } from "@/lib/utils/cn";
import { appendSpeechToTextarea } from "@/lib/features/voice-input";
import { useSpeechToText } from "@/lib/hooks/use-speech-to-text";
import { useVoiceInputOptional } from "@/components/voice/voice-input-provider";
import { forwardRef, useRef, type TextareaHTMLAttributes } from "react";
import { Mic, MicOff } from "lucide-react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  /** Muestra botón de dictado por voz (historias clínicas). */
  voiceInput?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, voiceInput = false, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s/g, "-");
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const voice = useVoiceInputOptional();
    const { listening, error: speechError, toggle, supported } = useSpeechToText();

    const showVoice =
      voiceInput &&
      voice?.isAvailable &&
      supported &&
      !props.readOnly &&
      !props.disabled;

    function setRefs(node: HTMLTextAreaElement | null) {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }

    function handleVoiceToggle() {
      const el = innerRef.current;
      if (!el) return;
      toggle((text) => appendSpeechToTextarea(el, text));
    }

    return (
      <div className="space-y-1">
        {(label || showVoice) && (
          <div className="flex items-center justify-between gap-2">
            {label ? (
              <label htmlFor={textareaId} className="drflow-ui-label block text-sm font-medium">
                {label}
              </label>
            ) : (
              <span />
            )}
            {showVoice ? (
              <button
                type="button"
                onClick={handleVoiceToggle}
                title={
                  listening
                    ? "Detener dictado"
                    : "Dictar por voz (español). Revisá el texto antes de guardar."
                }
                aria-label={listening ? "Detener dictado por voz" : "Iniciar dictado por voz"}
                aria-pressed={listening}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition",
                  listening
                    ? "bg-red-100 text-red-700 ring-1 ring-red-200"
                    : "bg-teal-50 text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100"
                )}
              >
                {listening ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    <MicOff className="h-3.5 w-3.5" />
                    Escuchando…
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" />
                    Dictar
                  </>
                )}
              </button>
            ) : null}
          </div>
        )}
        <textarea
          ref={setRefs}
          id={textareaId}
          className={cn(
            "drflow-ui-input w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-h-[100px]",
            error && "border-red-500",
            className
          )}
          {...props}
        />
        {speechError && showVoice ? (
          <p className="text-xs text-amber-700">{speechError}</p>
        ) : null}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
