import { test, expect } from "@playwright/test";

test.describe("DrFlow smoke E2E", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /ingresar|iniciar/i })).toBeVisible();
  });

  test("public privacy page", async ({ page }) => {
    await page.goto("/privacidad");
    await expect(page.locator("body")).toContainText(/DrFlow|privacidad/i);
  });

  test("health API returns JSON", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.headers()["content-type"]).toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("ok");
    expect(body).toHaveProperty("version");
  });

  test("version API returns JSON", async ({ request }) => {
    const res = await request.get("/api/version");
    const body = await res.json();
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Array.isArray(body.highlights)).toBe(true);
  });
});
