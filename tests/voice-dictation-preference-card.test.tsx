import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const voiceState = vi.hoisted(() => ({
  value: null as null | {
    clinicEnabled: boolean;
    userEnabled: boolean;
    envEnabled: boolean;
    browserSupported: boolean;
    setUserEnabled: (enabled: boolean) => void;
  },
  canUseVoice: true,
}));

vi.mock("@/features/voice/components/voice/voice-input-provider", () => ({
  useVoiceInputOptional: () => voiceState.value,
}));

vi.mock("@/core/components/entitlements/entitlements-provider", () => ({
  useCanUseVoiceInput: () => voiceState.canUseVoice,
}));

vi.mock("@/core/components/entitlements/addon-upgrade-notice", () => ({
  AddonUpgradeNotice: ({ feature }: { feature: string }) => <div data-testid="addon">{feature}</div>,
}));

import { VoiceDictationPreferenceCard } from "@/features/configuracion/components/configuracion/voice-dictation-preference-card";

afterEach(() => {
  cleanup();
  voiceState.value = null;
  voiceState.canUseVoice = true;
});

function voice(overrides: Partial<NonNullable<typeof voiceState.value>> = {}) {
  return {
    clinicEnabled: true,
    userEnabled: true,
    envEnabled: true,
    browserSupported: true,
    setUserEnabled: vi.fn(),
    ...overrides,
  };
}

describe("VoiceDictationPreferenceCard", () => {
  it("renders nothing outside a voice input provider", () => {
    const { container } = render(<VoiceDictationPreferenceCard />);
    expect(container.innerHTML).toBe("");
  });

  it("toggles the per-browser preference", () => {
    const state = voice({ userEnabled: true });
    voiceState.value = state;
    render(<VoiceDictationPreferenceCard />);

    fireEvent.click(screen.getByRole("button", { name: "Desactivar dictado" }));
    expect(state.setUserEnabled).toHaveBeenCalledWith(false);
  });

  it("shows upgrade notices and disables the toggle when the plan lacks voice", () => {
    voiceState.value = voice();
    voiceState.canUseVoice = false;
    render(<VoiceDictationPreferenceCard />);

    expect(screen.getByText(/no está incluido en el plan comercial/)).toBeTruthy();
    expect(screen.getAllByTestId("addon")).toHaveLength(2);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("explains when the clinic administrator disabled dictation", () => {
    voiceState.value = voice({ clinicEnabled: false });
    render(<VoiceDictationPreferenceCard />);
    expect(screen.getByText(/administrador del consultorio desactivó/)).toBeTruthy();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("warns when the browser does not support speech recognition", () => {
    voiceState.value = voice({ browserSupported: false });
    render(<VoiceDictationPreferenceCard />);
    expect(screen.getByText(/no soporta reconocimiento de voz/)).toBeTruthy();
  });
});
