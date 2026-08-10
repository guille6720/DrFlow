import { describe, expect, it, vi } from "vitest";

import { resolveProfessionalSignatureUrls } from "@/lib/server/resolve-professional-signature-urls";

describe("resolveProfessionalSignatureUrls", () => {
  it("uses createSignedUrls batch for multiple unique paths", async () => {
    const createSignedUrls = vi.fn(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })),
      error: null,
    }));
    const createSignedUrl = vi.fn(async () => {
      throw new Error("should use batch API for multiple paths");
    });

    const supabase = {
      storage: {
        from: () => ({
          createSignedUrls,
          createSignedUrl,
        }),
      },
    };

    const result = await resolveProfessionalSignatureUrls(supabase as never, [
      { id: "1", signature_image_path: "a.png" },
      { id: "2", signature_image_path: "b.png" },
      { id: "3", signature_image_path: "a.png" },
    ]);

    expect(createSignedUrls).toHaveBeenCalledOnce();
    expect(createSignedUrls).toHaveBeenCalledWith(["a.png", "b.png"], 3600);
    expect(result[0].signature_image_url).toBe("https://signed/a.png");
    expect(result[2].signature_image_url).toBe("https://signed/a.png");
  });

  it("skips storage when no signature paths", async () => {
    const createSignedUrls = vi.fn(async () => ({ data: [], error: null }));

    const supabase = {
      storage: {
        from: () => ({ createSignedUrls, createSignedUrl: vi.fn() }),
      },
    };

    const result = await resolveProfessionalSignatureUrls(supabase as never, [
      { id: "1", signature_image_path: null },
    ]);

    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(result[0].signature_image_url).toBeNull();
  });
});
