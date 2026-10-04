import { test, expect } from "@playwright/test";

// Flow: all 5 languages (spec section 28) render their own translated dashboard,
// and the language switcher in the nav actually changes the active language.
test.describe("Internationalization", () => {
  const languageHeadings: Record<string, string> = {
    en: "Dashboard",
    pt: "Painel",
    es: "Panel",
    de: "Übersicht",
    fr: "Tableau de bord",
  };

  for (const [lang, heading] of Object.entries(languageHeadings)) {
    test(`/${lang}/dashboard shows the ${lang} translation`, async ({ page }) => {
      await page.goto(`/${lang}/dashboard`);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    });
  }

  test("switching language via Settings updates the page", async ({ page }) => {
    await page.goto("/en/settings");
    const langSelect = page.locator('select[name="language"]');
    await langSelect.selectOption("pt");
    await page.getByRole("button", { name: "Save settings" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/pt\/settings$/);
    await expect(page.getByRole("heading", { name: "Definições" })).toBeVisible();

    // Restore English
    await langSelect.selectOption("en");
    await page.getByRole("button", { name: "Guardar definições" }).click();
    await page.waitForLoadState("networkidle");
  });
});

