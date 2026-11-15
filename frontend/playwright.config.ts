import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3011",
    headless: true,
    launchOptions: process.platform === "win32" ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } : {},
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `${process.platform === "win32" ? "..\\.venv\\Scripts\\python.exe" : "../.venv/bin/python"} -m uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 8011`,
      url: "http://127.0.0.1:8011/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { CORS_ORIGINS: "http://127.0.0.1:3011" },
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3011",
      url: "http://127.0.0.1:3011",
      env: { NEXT_PUBLIC_API_BASE_URL: "/service", FLAME_API_ORIGIN: "http://127.0.0.1:8011", NEXT_TELEMETRY_DISABLED: "1" },
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
    },
  ],
});
