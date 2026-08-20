"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isSpeechRecognitionSupported } from "@/features/voice/lib/voice-input";

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
  const [supported] = useState(() =>
    typeof window !== "undefined" ? isSpeechRecognitionSupported() : false
  );
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef<(text: string) => void>(() => {});
  const interimRef = useRef("");
  /** true while the user wants dictation active (survives Chrome's mid-session onend). */
  const wantListeningRef = useRef(false);

  const flushInterim = useCallback(() => {
    const pending = interimRef.current.trim();
    interimRef.current = "";
    if (pending) onFinalRef.current(pending);
  }, []);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    flushInterim();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, [flushInterim]);

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setError("Tu navegador no soporta dictado por voz. Usá Chrome o Edge.");
        return;
      }

      onFinalRef.current = onFinal;
      interimRef.current = "";
      setError(null);

      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }

      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const piece = result[0]?.transcript ?? "";
          if (result.isFinal) finalText += piece;
          else interimText += piece;
        }
        if (finalText.trim()) {
          interimRef.current = "";
          onFinalRef.current(finalText.trim());
        } else {
          interimRef.current = interimText;
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "aborted" || event.error === "no-speech") return;
        wantListeningRef.current = false;
        setError(
          event.error === "not-allowed"
            ? "Permiso de micrófono denegado. Habilitalo en el candado del navegador."
            : event.error === "network"
              ? "Sin conexión al servicio de reconocimiento de voz."
              : "No se pudo usar el dictado por voz."
        );
        setListening(false);
      };

      recognition.onend = () => {
        // Chrome often ends continuous sessions after a pause; restart if still wanted.
        if (wantListeningRef.current) {
          try {
            recognition.start();
            return;
          } catch {
            wantListeningRef.current = false;
          }
        }
        flushInterim();
        setListening(false);
      };

      recognitionRef.current = recognition;
      wantListeningRef.current = true;
      try {
        recognition.start();
        setListening(true);
      } catch {
        wantListeningRef.current = false;
        setError("No se pudo iniciar el dictado. Revisá el micrófono e intentá de nuevo.");
        setListening(false);
      }
    },
    [flushInterim, lang]
  );

  const toggle = useCallback(
    (onFinal: (text: string) => void) => {
      if (listening || wantListeningRef.current) {
        stop();
        return;
      }
      start(onFinal);
    },
    [listening, start, stop]
  );

  return { listening, supported, error, toggle, stop };
}
