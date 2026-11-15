import { test, expect } from "@playwright/test";
import { join } from "node:path";

// Flow: import a (synthetic) CGD statement, see the summary, re-import it and get no
// duplicates, then delete the import again so other specs see the original data.
test.describe("Bank import", () => {
  test("imports a CGD statement once and skips duplicates", async ({ page }) => {
    const fixture = join(process.cwd(), "fixtures/bank/cgd-sample.csv");

    await page.goto("/en/import");
    await expect(page.getByRole("heading", { name: "Bank import", level: 1 })).toBeVisible();
    await page.getByLabel("Set the account balance to the statement's closing balance").uncheck();
    await page.locator('input[type="file"][name="file"]').setInputFiles(fixture);
    await page.getByRole("button", { name: "Import movements" }).click();

    const summary = page.getByRole("status").filter({ hasText: "cgd-sample.csv imported" });
    await expect(summary).toContainText("7 movements read, 7 new (0 already imported).");
    await expect(summary).toContainText("Running balance checks out");
    await expect(page.getByRole("heading", { name: /^Proposals · / })).toBeVisible();

    await page.getByLabel("Set the account balance to the statement's closing balance").uncheck();
    await page.locator('input[type="file"][name="file"]').setInputFiles(fixture);
    await page.getByRole("button", { name: "Import movements" }).click();
    await expect(page.getByRole("status").filter({ hasText: "imported" })).toContainText("7 movements read, 0 new (7 already imported).");

    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Delete import: cgd-sample.csv" }).first().click();
    }
    await expect(page.getByRole("button", { name: /Delete import/ })).toHaveCount(0);
  });

  test("rejects a file that isn't a statement", async ({ page }) => {
    await page.goto("/en/import");
    await page.locator('input[type="file"][name="file"]').setInputFiles({ name: "x.csv", mimeType: "text/csv", buffer: Buffer.from("a;b\n1;2\n") });
    await page.getByRole("button", { name: "Import movements" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "supported bank statement" })).toBeVisible();
  });
});
