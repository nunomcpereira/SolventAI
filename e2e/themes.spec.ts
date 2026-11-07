import { test, expect } from "@playwright/test";

const THEMES = ["classic", "classic-dark", "ledger", "ledger-dark", "original"] as const;
const PAGES = ["dashboard", "accounts", "loans", "simulation", "settings", "upload"] as const;

test.describe("Themes", () => {
  for (const theme of THEMES) {
    test(`${theme}: every page renders without errors`, async ({ page, baseURL }) => {
      await page.context().addCookies([{ name: "solvent_theme", value: theme, url: baseURL! }]);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      for (const path of PAGES) {
        await page.goto(`/en/${path}`);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("heading", { level: 2 })).first()).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  }

  test("original theme swaps in the pre-redesign shell and dashboard", async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "solvent_theme", value: "original", url: baseURL! }]);
    await page.goto("/en/dashboard");
    await expect(page.getByText("Enterprise Finance")).toBeVisible();
    // Original dashboard: ring gauges, not the linear meters.
    await expect(page.locator("svg circle").first()).toBeVisible();
    await expect(page.getByRole("meter")).toHaveCount(0);
  });

  test("new-layout themes use the numbered sidebar and linear meters", async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "solvent_theme", value: "ledger", url: baseURL! }]);
    await page.goto("/en/dashboard");
    await expect(page.getByText("Enterprise Finance")).toHaveCount(0);
    await expect(page.getByRole("meter").first()).toBeVisible();
  });

  test("the sidebar switcher changes theme and remembers it", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");

    await page.locator('select[name="theme"]').selectOption("ledger");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ledger");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ledger");

    await page.locator('select[name="theme"]').selectOption("original");
    await expect(page.getByText("Enterprise Finance")).toBeVisible();

    // The original shell has its own switcher; switching back restores the new layout.
    await page.locator('select[name="theme"]').selectOption("classic");
    await expect(page.getByText("Enterprise Finance")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");
  });
});

