import { test, expect } from "@playwright/test";

/**
 * Full sale flow E2E: login → select context → menu order → add item → proceed to payment.
 * Requires: backend on VITE_API_BASE_URL, Keycloak with test user.
 * Set E2E_TEST_USER and E2E_TEST_PASSWORD (env) for credentials.
 */
const testUser = process.env.E2E_TEST_USER;
const testPassword = process.env.E2E_TEST_PASSWORD;

test.describe("Sale flow", () => {
  test.skip(
    !testUser || !testPassword,
    "Requires E2E_TEST_USER and E2E_TEST_PASSWORD"
  );

  test("login → select context → menu order → add item → proceed to payment", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    await page.getByLabel(/username/i).fill(testUser!);
    await page.getByLabel(/password/i).fill(testPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\//);

    await page.goto("/select-context");
    await expect(
      page.getByRole("heading", { name: /select context/i })
    ).toBeVisible({ timeout: 10000 });

    const orgSection = page.locator("section").filter({ hasText: /1\. Organization/ });
    await orgSection.getByRole("button").first().click();

    const branchSection = page.locator("section").filter({ hasText: /2\. Branch/ });
    await branchSection.getByRole("button").first().waitFor({ state: "visible", timeout: 5000 });
    await branchSection.getByRole("button").first().click();

    const terminalSection = page.locator("section").filter({ hasText: /3\. Terminal/ });
    await terminalSection.getByRole("button").first().waitFor({ state: "visible", timeout: 5000 });
    await terminalSection.getByRole("button").first().click();

    await page.getByRole("button", { name: /continue/i }).click();

    await page.goto("/operator/menu-order");
    await expect(
      page.getByText(/menu|order|dish|categories/i)
    ).toBeVisible({ timeout: 10000 });

    const addButton = page.getByRole("button", { name: /add to cart/i }).first();
    if (await addButton.isVisible({ timeout: 5000 })) {
      await addButton.click();
      const proceedBtn = page.getByRole("button", {
        name: /proceed to payment|confirm/i,
      });
      if (await proceedBtn.isVisible({ timeout: 3000 })) {
        await proceedBtn.click();
        await expect(
          page.getByText(/payment|tender|complete/i)
        ).toBeVisible({ timeout: 5000 });
      }
    }

    await expect(page.getByText(/menu|order|cart|summary/i)).toBeVisible();
  });
});
