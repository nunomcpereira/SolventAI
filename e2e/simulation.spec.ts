import { test, expect } from "@playwright/test";

// Flow: create a scenario, select it, add a one-time-expense event to it, and
// confirm it persists (survives reload) and can be deleted — the persisted
// version of spec section 21's "add events / compare scenarios / delete events".
test.describe("Simulation scenarios", () => {
  test("create, select, add an event, and delete a scenario", async ({ page }) => {
    const scenarioName = `E2E Scenario ${Date.now()}`;

    await page.goto("/en/simulation");
    await page.getByPlaceholder("New scenario name").fill(scenarioName);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("link", { name: new RegExp(scenarioName) })).toBeVisible();

    await page.getByRole("link", { name: new RegExp(scenarioName) }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(`Add a one-time expense event to`)).toBeVisible();
    await page.getByRole("button", { name: "Add event" }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("link", { name: `${scenarioName} (1 events)` })).toBeVisible();

    // Survives reload (persisted, not just client state).
    await page.reload();
    await expect(page.getByRole("link", { name: `${scenarioName} (1 events)` })).toBeVisible();

    // Clean up.
    const row = page.locator("li", { hasText: scenarioName });
    await row.getByRole("button", { name: "Delete" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("li", { hasText: scenarioName })).toHaveCount(0);
  });
});
