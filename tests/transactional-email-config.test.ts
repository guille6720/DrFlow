import { afterEach, describe, expect, it } from "vitest";

import { isTransactionalEmailConfigured } from "@/lib/services/transactional-email";

describe("isTransactionalEmailConfigured", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("returns false without EMAIL_FROM", () => {
    delete process.env.EMAIL_FROM;
    process.env.RESEND_API_KEY = "re_test";
    expect(isTransactionalEmailConfigured()).toBe(false);
  });

  it("returns true with EMAIL_FROM and RESEND_API_KEY", () => {
    process.env.EMAIL_FROM = "NexClinic <noreply@test.com>";
    process.env.RESEND_API_KEY = "re_test";
    expect(isTransactionalEmailConfigured()).toBe(true);
  });

  it("returns true with EMAIL_FROM and SMTP credentials", () => {
    process.env.EMAIL_FROM = "NexClinic <noreply@test.com>";
    delete process.env.RESEND_API_KEY;
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASSWORD = "pass";
    expect(isTransactionalEmailConfigured()).toBe(true);
  });
});
