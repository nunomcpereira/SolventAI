import { test, expect } from "@playwright/test";

// Flow: settings changes persist across a page reload (server-action write ->
// SQLite -> re-read), and the privacy note (spec section 27) is always visible.
test.describe("Settings", () => {
  test("shows the local-first privacy note", async ({ page }) => {
    await page.goto("/en/settings");
    // The AppShell sidebar also has a "Local-first" tagline, so match the full
    // privacy-note sentence specifically rather than the ambiguous substring.
    await expect(page.getByText(/SolventAI is local-first/i)).toBeVisible();
  });

  test("saving a changed base currency persists after reload", async ({ page }) => {
    await page.goto("/en/settings");
    const currencySelect = page.locator('select[name="baseCurrency"]');
    await currencySelect.selectOption("USD");
    await page.getByRole("button", { name: "Save settings" }).click();

    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.locator('select[name="baseCurrency"]')).toHaveValue("USD");

    // Restore EUR so other tests relying on EUR-denominated seed data stay valid.
    await page.locator('select[name="baseCurrency"]').selectOption("EUR");
    await page.getByRole("button", { name: "Save settings" }).click();
    await page.waitForLoadState("networkidle");
  });
});
