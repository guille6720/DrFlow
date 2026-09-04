import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/transactional-email", () => ({
  sendTransactionalEmail: vi.fn(),
}));

import { deliverReminderEmail } from "@/lib/services/reminder-email";
import { sendTransactionalEmail } from "@/lib/services/transactional-email";

describe("deliverReminderEmail", () => {
  it("returns sent when transactional email succeeds", async () => {
    vi.mocked(sendTransactionalEmail).mockResolvedValueOnce({ sent: true, provider: "resend" });

    const result = await deliverReminderEmail({
      to: "paciente@example.com",
      message: "Recordatorio de turno",
    });

    expect(result.status).toBe("sent");
    expect(result.provider).toBe("resend");
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "paciente@example.com",
        subject: "Recordatorio de turno — NexClinic",
      })
    );
  });

  it("returns failed with reason when provider errors", async () => {
    vi.mocked(sendTransactionalEmail).mockResolvedValueOnce({
      sent: false,
      reason: "SMTP timeout",
    });

    const result = await deliverReminderEmail({
      to: "paciente@example.com",
      message: "Hola",
    });

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("SMTP timeout");
  });
});
