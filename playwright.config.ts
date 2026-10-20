import { defineConfig, devices } from "@playwright/test";

const configured = process.env.BASE_URL;
const previewPath = `/${(process.env.VITE_BASE_PATH || "/").replace(/^\/+|\/+$/g, "")}`;
const baseURL = configured
  ? `${configured.replace(/\/$/, "")}/`
  : `http://127.0.0.1:4173${previewPath.endsWith("/") ? previewPath : `${previewPath}/`}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    acceptDownloads: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: configured
    ? undefined
    : {
        command: "npm run preview -- --port 4173 --strictPort",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
