import { defineConfig, devices } from "@playwright/test";

const PORT = 3510;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "rm -f ./data/e2e-test.db && npm run build && npm run start -- -p " + PORT,
    url: `http://localhost:${PORT}/en/dashboard`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      SOLVENT_DB_PATH: "./data/e2e-test.db",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
