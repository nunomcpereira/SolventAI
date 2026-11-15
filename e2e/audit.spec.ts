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
    await expect(section.getByText(scenarioName).first()).toBeVisible();
    await expect(section.getByText("Rounding").first()).toBeVisible();

    await section.getByRole("link", { name: /View full audit log/ }).click();
    await expect(page).toHaveURL(/\/en\/settings\/audit/);
    await expect(page.getByRole("heading", { name: "Audit log", level: 1 })).toBeVisible();

    await page.getByRole("link", { name: "Scenario", exact: true }).click();
    await expect(page).toHaveURL(/type=scenario/);
    await expect(page.getByText(scenarioName).first()).toBeVisible();
    await expect(page.getByText("Rounding")).toHaveCount(0);
  });

  test("an entry links to its page as it was before the change, read-only", async ({ page }) => {
    await page.goto("/en/settings");
    const rounding = page.locator('select[name="roundingMode"]');
    const previous = await rounding.inputValue();
    const next = previous === "half-up" ? "half-even" : "half-up";
    await rounding.selectOption(next);
    await page.getByRole("button", { name: "Save settings" }).click();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.locator('select[name="roundingMode"]')).toHaveValue(next);

    await page.goto("/en/settings/audit?type=settings");
    await page.getByRole("link", { name: "View page before this change" }).first().click();
    await expect(page).toHaveURL(/\/en\/settings\?before=/);
    await expect(page.getByTestId("past-version-banner")).toBeVisible();
    await expect(page.locator('select[name="roundingMode"]')).toHaveValue(previous);

    // Navigating elsewhere stays in the past version.
    await page.getByRole("link", { name: /Loans and expenses/ }).first().click();
    await expect(page).toHaveURL(/\/en\/loans\?before=/);
    await expect(page.getByTestId("past-version-banner")).toBeVisible();
    await page.getByRole("link", { name: /^(\d+\s*)?Settings$/ }).first().click();
    await expect(page).toHaveURL(/\/en\/settings\?before=/);

    await page.getByRole("link", { name: "Back to current version" }).click();
    await expect(page.getByTestId("past-version-banner")).toHaveCount(0);
    await expect(page.locator('select[name="roundingMode"]')).toHaveValue(next);
  });

  test("every page renders as a past version", async ({ page }) => {
    const before = encodeURIComponent(new Date(Date.now() - 60_000).toISOString());
    for (const path of ["dashboard", "accounts", "loans", "simulation", "settings", "upload"]) {
      const response = await page.goto(`/en/${path}?before=${before}`);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByTestId("past-version-banner"), path).toBeVisible();
    }
  });

  test("restoring the version before a change writes it back and logs the restore", async ({ page }) => {
    await page.goto("/en/settings");
    const rounding = page.locator('select[name="roundingMode"]');
    const previous = await rounding.inputValue();
    const next = previous === "half-up" ? "half-even" : "half-up";
    await rounding.selectOption(next);
    await page.getByRole("button", { name: "Save settings" }).click();
    await page.waitForLoadState("networkidle");

    await page.goto("/en/settings/audit?type=settings");
    const entry = page.getByRole("listitem").filter({ has: page.getByTestId("audit-restore") }).first();
    await entry.getByText("Restore previous version").click();
    await entry.getByRole("button", { name: "Confirm restore" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Version restored." })).toBeVisible();

    await page.goto("/en/settings");
    await expect(page.locator('select[name="roundingMode"]')).toHaveValue(previous);
  });

  test("an entry shows its impact on the key figures, loaded on demand", async ({ page }) => {
    const name = `Impact e2e ${Date.now()}`;
    await page.goto("/en/accounts");
    await page.getByText("Add account").click();
    const form = page.locator("form").filter({ has: page.locator('input[name="currency"]') });
    await form.locator('input[name="name"]').fill(name);
    await form.locator('input[name="balance"]').fill("1234");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.goto("/en/settings/audit?type=account");
    const entry = page.getByRole("listitem").filter({ hasText: name }).first();
    await entry.getByText("Impact on key figures").click();
    const impact = entry.getByTestId("audit-impact");
    await expect(impact.getByText("Total liquidity")).toBeVisible({ timeout: 15_000 });
    await expect(impact.getByText("+€1,234.00").first()).toBeVisible();
  });

  test("picking a moment opens the app as it was then", async ({ page }) => {
    await page.goto("/en/settings/audit");
    const picker = page.locator("form[data-past-version-picker]");
    await picker.locator('input[type="datetime-local"]').fill("2026-01-01T12:00");
    await picker.getByRole("button", { name: "Go" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\?before=2026-01-01T/);
    await expect(page.getByTestId("past-version-banner")).toBeVisible();
  });
});
