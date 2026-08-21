"use client";

import { Mic, MicOff } from "lucide-react";
import {
  type ChangeEvent,
  forwardRef,
  type ReactNode,
  type TextareaHTMLAttributes,
  useRef,
} from "react";

import { cn } from "@/shared/utils/cn";

import { useVoiceInputOptional } from "@/features/voice/components/voice/voice-input-provider";
import { useSpeechToText } from "@/features/voice/hooks/use-speech-to-text";
import { appendSpeechToTextarea } from "@/features/voice/lib/voice-input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: ReactNode;
  /** Muestra botón de dictado por voz (historias clínicas). */
  voiceInput?: boolean;
  /** Expande verticalmente dentro de un contenedor flex. */
  grow?: boolean;
  /** Called after speech-to-text appends a final transcript. */
  onVoiceAppend?: (appendedText: string, fullValue: string) => void;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      id,
      required,
      voiceInput = false,
      grow = false,
      onVoiceAppend,
      onKeyDown,
      onChange,
      ...props
    },
    ref
  ) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s/g, "-");
    const helperId = helperText && textareaId ? `${textareaId}-helper` : undefined;
    const errorId = error && textareaId ? `${textareaId}-error` : undefined;
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const voice = useVoiceInputOptional();
    const { listening, error: speechError, toggle, stop, supported } = useSpeechToText();

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

    function syncControlledValue(el: HTMLTextAreaElement) {
      if (!onChange) return;
      const event = {
        target: el,
        currentTarget: el,
      } as ChangeEvent<HTMLTextAreaElement>;
      onChange(event);
    }

    function handleVoiceToggle() {
      const el = innerRef.current;
      if (!el) return;
      toggle((text) => {
        appendSpeechToTextarea(el, text);
        syncControlledValue(el);
        onVoiceAppend?.(text, el.value);
      });
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (listening && event.key === "Enter") {
        stop();
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          return;
        }
      }
      onKeyDown?.(event);
    }

    return (
      <div className={cn("space-y-1", grow && "flex min-h-0 flex-1 flex-col")}>
        {(label || showVoice) && (
          <div className="flex items-center justify-between gap-2">
            {label ? (
              <label
                htmlFor={textareaId}
                className={cn(
                  "drflow-ui-label block text-sm font-medium",
                  error && "drflow-ui-label-error"
                )}
                data-invalid={error ? "true" : undefined}
              >
                {label}
                {required ? (
                  <span className="drflow-ui-required" aria-hidden="true">
                    *
                  </span>
                ) : null}
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
                    ? "Clic o Enter para detener y guardar el texto dictado"
                    : "Dictar por voz (español). Revisá el texto antes de guardar la consulta."
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
        {showVoice && listening ? (
          <p
            className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800"
            role="status"
            aria-live="polite"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
            </span>
            Hablá con claridad. Clic en Escuchando… o Enter para volcar el texto al campo.
          </p>
        ) : null}
        <textarea
          ref={setRefs}
          id={textareaId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={[helperId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "drflow-ui-input w-full rounded-[10px] border border-[var(--border-strong,var(--border,#cbd5e1))] bg-[var(--surface-input,var(--input,var(--card,#fff)))] px-3 py-2 text-sm text-[var(--text-primary,var(--foreground))] placeholder:text-[var(--placeholder,var(--text-muted,#64748b))] focus:border-[var(--ring)] focus:outline-none focus:ring-[3px] focus:ring-[var(--ring)]/15 min-h-[100px] disabled:cursor-not-allowed",
            grow && "min-h-[12rem] flex-1 resize-y",
            error && "drflow-ui-input-error border-[var(--destructive)]",
            className
          )}
          {...props}
          onChange={onChange}
          onKeyDown={handleKeyDown}
        />
        {speechError && showVoice ? (
          <p className="text-xs text-amber-700">{speechError}</p>
        ) : null}
        {helperText && !error ? (
          <p id={helperId} className="drflow-ui-helper">
            {helperText}
          </p>
        ) : null}
        {error && (
          <p id={errorId} className="drflow-ui-error text-xs" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
