"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  isSpeechRecognitionSupported,
  isVoiceInputAvailable,
  isVoiceInputEnvEnabled,
  readVoiceInputUserPref,
  writeVoiceInputUserPref,
} from "@/features/voice/lib/voice-input";

type VoiceInputContextValue = {
  clinicEnabled: boolean;
  userEnabled: boolean;
  setUserEnabled: (enabled: boolean) => void;
  envEnabled: boolean;
  browserSupported: boolean;
  isAvailable: boolean;
};

const VoiceInputContext = createContext<VoiceInputContextValue | null>(null);

export function VoiceInputProvider({
  children,
  clinicVoiceInputEnabled = true,
}: {
  children: ReactNode;
  clinicVoiceInputEnabled?: boolean;
}) {
  const [userEnabled, setUserEnabledState] = useState(true);
  const [browserSupported, setBrowserSupported] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setUserEnabledState(readVoiceInputUserPref());
      setBrowserSupported(isSpeechRecognitionSupported());
    });
  }, []);

  const setUserEnabled = useCallback((enabled: boolean) => {
    setUserEnabledState(enabled);
    writeVoiceInputUserPref(enabled);
  }, []);

  const value = useMemo(
    () => ({
      clinicEnabled: clinicVoiceInputEnabled,
      userEnabled,
      setUserEnabled,
      envEnabled: isVoiceInputEnvEnabled(),
      browserSupported,
      isAvailable: isVoiceInputAvailable({
        clinicEnabled: clinicVoiceInputEnabled,
        userEnabled,
        browserSupported,
      }),
    }),
    [browserSupported, clinicVoiceInputEnabled, userEnabled, setUserEnabled]
  );

  return <VoiceInputContext.Provider value={value}>{children}</VoiceInputContext.Provider>;
}

export function useVoiceInput() {
  const ctx = useContext(VoiceInputContext);
  if (!ctx) {
    throw new Error("useVoiceInput must be used within VoiceInputProvider");
  }
  return ctx;
}

export function useVoiceInputOptional() {
  return useContext(VoiceInputContext);
}
