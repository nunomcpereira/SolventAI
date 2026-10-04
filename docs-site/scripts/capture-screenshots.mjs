// Captures documentation screenshots from a running Solvent AI dev server, using the
// "demo-2" tenant. Navigation only — never submits a form, so tenant data is untouched.
//
//   cd .. && npm run dev            # app on :5555
//   node scripts/capture-screenshots.mjs [baseUrl]
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BASE_URL = process.argv[2] ?? "http://localhost:5555";
const TENANT = process.env.SOLVENT_DOCS_TENANT ?? "demo-2";
const OUT_DIR = fileURLToPath(new URL("../static/img/screenshots/", import.meta.url));

/** @type {{ name: string; path: string; mobile?: boolean; fullPage?: boolean; before?: (page: import("@playwright/test").Page) => Promise<void> }[]} */
const SHOTS = [
  { name: "dashboard", path: "/en/dashboard" },
  { name: "dashboard-full", path: "/en/dashboard", fullPage: true },
  {
    name: "dashboard-wizard-loan",
    path: "/en/dashboard",
    fullPage: true,
    before: async (page) => {
      await page.getByText("Create a new loan").click();
      await page.waitForTimeout(500);
    },
  },
  { name: "dashboard-history", path: "/en/dashboard?monthOffset=-6" },
  { name: "accounts", path: "/en/accounts", fullPage: true },
  { name: "loans", path: "/en/loans", fullPage: true },
  {
    name: "loans-amortization",
    path: "/en/loans",
    fullPage: true,
    before: async (page) => {
      await page.getByText("View amortization chart").last().click();
      await page.waitForTimeout(1200);
    },
  },
  {
    name: "loans-add-loan",
    path: "/en/loans",
    fullPage: true,
    before: async (page) => {
      await page.locator("summary", { hasText: "Add Loan" }).click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "loans-edit-loan",
    path: "/en/loans",
    fullPage: true,
    before: async (page) => {
      await page.locator("summary", { hasText: "Edit Loan" }).last().click();
      await page.waitForTimeout(500);
    },
  },
  { name: "upload", path: "/en/upload" },
  { name: "simulation", path: "/en/simulation", fullPage: true },
  { name: "simulation-unemployment", path: "/en/simulation?scenarioId=scenario-unemployment", fullPage: true },
  {
    name: "simulation-edit-event",
    path: "/en/simulation?scenarioId=scenario-unemployment&editEventId=scenario-unemployment-ev5",
  },
  { name: "simulation-new", path: "/en/simulation?new=1" },
  { name: "settings", path: "/en/settings", fullPage: true },
  { name: "dashboard-pt", path: "/pt/dashboard" },
  { name: "mobile-dashboard", path: "/en/dashboard", mobile: true },
  { name: "mobile-simulation", path: "/en/simulation?scenarioId=scenario-unemployment", mobile: true },
];

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const host = new URL(BASE_URL).hostname;

for (const shot of SHOTS) {
  const context = await browser.newContext(
    shot.mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  );
  await context.addCookies([{ name: "solvent_tenant", value: TENANT, domain: host, path: "/" }]);
  const page = await context.newPage();
  await page.goto(BASE_URL + shot.path, { waitUntil: "networkidle" });
  // Recharts animates lines in; let it settle before capturing.
  await page.waitForTimeout(1500);
  // Hide the Next.js dev-mode badge.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  if (shot.before) await shot.before(page);
  if (shot.fullPage) {
    // Grow the viewport to the page height instead of Playwright's fullPage stitching, so
    // the fixed sidebar spans the whole capture rather than stopping at the first screen.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: page.viewportSize().width, height });
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: `${OUT_DIR}${shot.name}.png` });
  console.log(`✓ ${shot.name}`);
  await context.close();
}

await browser.close();
