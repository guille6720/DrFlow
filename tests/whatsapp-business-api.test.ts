import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatWhatsAppRecipient,
  getWhatsAppConfigurationHint,
  isWhatsAppApiConfigured,
  resolveWhatsAppDeliveryMode,
  sendWhatsAppTextMessage,
} from "@/core/whatsapp/provider";

describe("whatsapp cloud api provider", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("detects configuration from env", () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    expect(isWhatsAppApiConfigured()).toBe(false);
    expect(resolveWhatsAppDeliveryMode()).toBe("manual");
    expect(getWhatsAppConfigurationHint()).toContain("WHATSAPP_ACCESS_TOKEN");

    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    expect(isWhatsAppApiConfigured()).toBe(true);
    expect(resolveWhatsAppDeliveryMode()).toBe("api");
  });

  it("normalizes Argentina mobile numbers", () => {
    expect(formatWhatsAppRecipient("11 5259-1607")).toBe("5491152591607");
    expect(formatWhatsAppRecipient("5491152591607")).toBe("5491152591607");
    expect(formatWhatsAppRecipient("123")).toBeNull();
  });

  it("sends text via graph api when configured", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-id";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.test" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTextMessage({
      to: "11 5259-1607",
      text: "Hola paciente",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toBe("wamid.test");
    }
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/phone-id/messages"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
