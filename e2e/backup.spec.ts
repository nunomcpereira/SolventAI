import { test, expect } from "@playwright/test";

// Flow: download a backup from Settings, change data, restore the backup, and the
// change is gone. Also: a restore POST from another origin is refused.
test.describe("Backup & restore", () => {
  test("downloaded backup restores the data it was taken from", async ({ page }) => {
    await page.goto("/en/settings#backup");
    const section = page.locator("#backup");
    await expect(section.getByRole("heading", { name: "Backup & restore" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await section.getByRole("link", { name: "Download backup" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^solvent-.*\.db$/);
    const backupPath = await download.path();

    // Change something after the backup was taken.
    const scenarioName = `After backup ${Date.now()}`;
    await page.goto("/en/simulation");
    await page.getByPlaceholder("New scenario name").fill(scenarioName);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(scenarioName) })).toBeVisible();

    // Restore: the button stays disabled until a file is chosen and the box is ticked.
    await page.goto("/en/settings#backup");
    const restore = section.getByRole("button", { name: "Restore backup" });
    await section.locator('input[type="file"]').setInputFiles(backupPath);
    await expect(restore).toBeDisabled();
    await section.getByLabel(/replaces all current data/).check();
    await restore.click();
    await expect(section.getByText("Backup restored.")).toBeVisible();

    await page.goto("/en/simulation");
    await expect(page.getByRole("link", { name: new RegExp(scenarioName) })).toHaveCount(0);
  });

  test("rejects a file that isn't a database", async ({ page }) => {
    await page.goto("/en/settings#backup");
    const section = page.locator("#backup");
    await section.locator('input[type="file"]').setInputFiles({
      name: "notes.db",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("definitely not sqlite"),
    });
    await section.getByLabel(/replaces all current data/).check();
    await section.getByRole("button", { name: "Restore backup" }).click();
    await expect(section.getByText("This isn't a database file.")).toBeVisible();
  });

  test("refuses a restore from another origin", async ({ request }) => {
    const response = await request.post("/api/backup", {
      headers: { Origin: "https://evil.example" },
      multipart: { file: { name: "x.db", mimeType: "application/octet-stream", buffer: Buffer.from("x") } },
    });
    expect(response.status()).toBe(403);
  });
});
