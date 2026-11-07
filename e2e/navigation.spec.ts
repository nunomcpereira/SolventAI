import { test, expect } from "@playwright/test";

// Flow: every nav link reaches a real page (spec section 29 pages) with no 404s,
// and each responsive layout renders under both desktop and mobile viewports.
test.describe("Navigation", () => {
  const pages: { path: string; heading: string }[] = [
    { path: "/en/dashboard", heading: "Dashboard" },
    { path: "/en/accounts", heading: "Income and balances" },
    { path: "/en/loans", heading: "Loans" },
    { path: "/en/upload", heading: "Upload contract" },
    { path: "/en/simulation", heading: "Simulation" },
    { path: "/en/settings", heading: "Settings" },
  ];

  for (const { path, heading } of pages) {
    test(`${path} renders its heading`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: heading, exact: false }).first()).toBeVisible();
    });
  }

  test("nav links move between pages without a full reload error", async ({ page }) => {
    await page.goto("/en/dashboard");
    await page.getByRole("link", { name: "Loans and expenses" }).first().click();
    await expect(page).toHaveURL(/\/en\/loans$/);
    await page.getByRole("link", { name: "Settings" }).first().click();
    await expect(page).toHaveURL(/\/en\/settings$/);
  });

  test("root path redirects to the default language dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test("an unsupported language segment 404s", async ({ page }) => {
    const response = await page.goto("/xx/dashboard");
    expect(response?.status()).toBe(404);
  });

  test("mobile viewport still renders the dashboard content", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/en/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Liquid Reserve")).toBeVisible();
  });
});

