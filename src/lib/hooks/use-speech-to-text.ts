"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSpeechRecognitionSupported } from "@/lib/features/voice-input";

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultListLike }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: {
    isFinal: boolean;
    0?: { transcript?: string };
  };
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionInstance)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechToText(lang = "es-AR") {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setError("Tu navegador no soporta dictado por voz.");
        return;
      }

      onFinalRef.current = onFinal;
      setError(null);

      recognitionRef.current?.abort();

      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0]?.transcript ?? "";
          }
        }
        if (finalText.trim()) {
          onFinalRef.current(finalText.trim());
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "aborted" || event.error === "no-speech") return;
        setError(
          event.error === "not-allowed"
            ? "Permiso de micrófono denegado. Habilitalo en el navegador."
            : "No se pudo usar el dictado por voz."
        );
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setListening(true);
      } catch {
        setError("No se pudo iniciar el dictado.");
        setListening(false);
      }
    },
    [lang]
  );

  const toggle = useCallback(
    (onFinal: (text: string) => void) => {
      if (listening) {
        stop();
        return;
      }
      start(onFinal);
    },
    [listening, start, stop]
  );

  return { listening, supported, error, toggle, stop };
}
