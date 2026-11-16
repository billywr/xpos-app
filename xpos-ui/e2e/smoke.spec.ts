import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("unauthenticated user visiting / redirects to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page shows sign in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("login page shows XPOS branding", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("XPOS")).toBeVisible();
  });
});
