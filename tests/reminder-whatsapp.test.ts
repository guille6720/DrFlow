import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/whatsapp-message", () => ({
  deliverWhatsAppMessage: vi.fn(),
}));

import { deliverReminderWhatsApp } from "@/lib/services/reminder-whatsapp";
import { deliverWhatsAppMessage } from "@/lib/services/whatsapp-message";

describe("deliverReminderWhatsApp", () => {
  it("returns sent when cloud api succeeds", async () => {
    vi.mocked(deliverWhatsAppMessage).mockResolvedValueOnce({
      status: "sent",
      mode: "api",
      messageId: "wamid.abc",
    });

    const result = await deliverReminderWhatsApp({
      to: "5491152591607",
      message: "Recordatorio",
    });

    expect(result.status).toBe("sent");
    expect(result.messageId).toBe("wamid.abc");
    expect(result.deliveryMode).toBe("api");
  });

  it("returns simulated with wa.me url in manual mode", async () => {
    vi.mocked(deliverWhatsAppMessage).mockResolvedValueOnce({
      status: "manual",
      mode: "manual",
      whatsappUrl: "https://wa.me/5491152591607?text=Hola",
    });

    const result = await deliverReminderWhatsApp({
      to: "5491152591607",
      message: "Hola",
    });

    expect(result.status).toBe("simulated");
    expect(result.whatsappUrl).toContain("wa.me");
    expect(result.deliveryMode).toBe("manual");
  });

  it("returns failed when api errors", async () => {
    vi.mocked(deliverWhatsAppMessage).mockResolvedValueOnce({
      status: "failed",
      mode: "api",
      errorMessage: "HTTP 401",
    });

    const result = await deliverReminderWhatsApp({
      to: "5491152591607",
      message: "Hola",
    });

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("HTTP 401");
  });
});
