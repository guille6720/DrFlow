import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "@/shared/utils/whatsapp";
import { orderTypeLabel } from "@/features/recetas/utils/order-type-label";

describe("orderTypeLabel", () => {
  it("maps known order types", () => {
    expect(orderTypeLabel("referral")).toBe("Derivación");
    expect(orderTypeLabel("pami_form")).toBe("Planilla PAMI");
    expect(orderTypeLabel(undefined)).toBe("Estudios");
  });
});

describe("buildWhatsAppUrl", () => {
  it("builds wa.me link with encoded text", () => {
    const url = buildWhatsAppUrl("5491112345678", "Orden médica");
    expect(url).toBe("https://wa.me/5491112345678?text=Orden%20m%C3%A9dica");
  });
});
