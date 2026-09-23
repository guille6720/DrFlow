import { afterEach, describe, expect, it } from "vitest";

import {
  buildClinicInviteEmailContent,
  getFromAddress,
  isTransactionalEmailConfigured,
} from "@/lib/services/transactional-email";

describe("isTransactionalEmailConfigured", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("returns false without transport", () => {
    delete process.env.EMAIL_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(isTransactionalEmailConfigured()).toBe(false);
  });

  it("returns true with EMAIL_FROM and RESEND_API_KEY", () => {
    process.env.EMAIL_FROM = "NexClinic <noreply@test.com>";
    process.env.RESEND_API_KEY = "re_test";
    expect(isTransactionalEmailConfigured()).toBe(true);
  });

  it("returns true with SMTP credentials even without EMAIL_FROM", () => {
    delete process.env.EMAIL_FROM;
    delete process.env.RESEND_API_KEY;
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "noreply@opusorg.com";
    process.env.SMTP_PASSWORD = "pass";
    expect(getFromAddress()).toContain("noreply@opusorg.com");
    expect(isTransactionalEmailConfigured()).toBe(true);
  });
});

describe("buildClinicInviteEmailContent", () => {
  it("includes login credentials and html CTA", () => {
    const content = buildClinicInviteEmailContent({
      fullName: "Dra. Lorena",
      clinicName: "Abuelitos",
      email: "lorena@example.com",
      password: "TempPass123!",
      credentialsPath: "/acceso-invitado/abc",
    });
    expect(content.subject).toContain("Abuelitos");
    expect(content.text).toContain("lorena@example.com");
    expect(content.text).toContain("TempPass123!");
    expect(content.html).toContain("Iniciar sesión");
    expect(content.html).toContain("lorena@example.com");
  });
});
