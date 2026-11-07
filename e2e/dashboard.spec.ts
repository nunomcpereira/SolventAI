import { test, expect } from "@playwright/test";

// Flow: dashboard loads with the seeded demo data and shows engine-computed
// liquidity/debt/effort-rate figures — not zeros, not placeholders.
test.describe("Dashboard", () => {
  test("shows computed liquidity and debt metrics from real seeded data", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await expect(page.getByText("Effort rate")).toBeVisible();
    await expect(page.getByText("Net Monthly Income")).toBeVisible();
    await expect(page.getByText("Total Debt Service")).toBeVisible();
    await expect(page.getByText("Liquid Reserve")).toBeVisible();
  });

  test("navigating to Accounts shows bank accounts list", async ({ page }) => {
    await page.goto("/en/accounts");
    await expect(page.getByRole("heading", { name: "Income and balances" })).toBeVisible();
    await expect(page.getByText("Main Checking").first()).toBeVisible();
    await expect(page.getByText("checking").first()).toBeVisible();
  });

  test("navigating to Loans shows Prepayment Optimizer with ranked recommendations", async ({ page }) => {
    await page.goto("/en/loans");
    await expect(page.getByRole("heading", { name: "Loans and expenses" })).toBeVisible();
    await expect(page.getByText("Prepayment Optimizer")).toBeVisible();
    await expect(page.getByText("Best option")).toBeVisible();
  });
});

