import { test, expect } from "@playwright/test";

test.describe("Audit log", () => {
  test("a settings change and a new scenario show up in Settings and on the full log", async ({ page }) => {
    const scenarioName = `Audit e2e ${Date.now()}`;
    await page.goto("/en/simulation");
    await page.getByPlaceholder("New scenario name").fill(scenarioName);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(scenarioName) })).toBeVisible();

    await page.goto("/en/settings");
    const rounding = page.locator('select[name="roundingMode"]');
    const next = (await rounding.inputValue()) === "half-up" ? "half-even" : "half-up";
    await rounding.selectOption(next);
    await page.getByRole("button", { name: "Save settings" }).click();
    await page.waitForLoadState("networkidle");

    await page.goto("/en/settings#audit");
    const section = page.locator("#audit");
    await expect(section.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(section.getByText(scenarioName)).toBeVisible();
    await expect(section.getByText("Rounding").first()).toBeVisible();

    await section.getByRole("link", { name: /View full audit log/ }).click();
    await expect(page).toHaveURL(/\/en\/settings\/audit/);
    await expect(page.getByRole("heading", { name: "Audit log", level: 1 })).toBeVisible();

    await page.getByRole("link", { name: "Scenario", exact: true }).click();
    await expect(page).toHaveURL(/type=scenario/);
    await expect(page.getByText(scenarioName)).toBeVisible();
    await expect(page.getByText("Rounding")).toHaveCount(0);
  });
});
