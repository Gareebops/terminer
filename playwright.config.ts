import { defineConfig, devices } from "@playwright/test";

// E2E testovi rade ISKLJUČIVO protiv lokalnog Supabase stacka (guard u
// tests/e2e/global-setup.ts odbija sve što nije localhost) - na CI-ju ga
// podiže `supabase start`, lokalno traži Docker. Server pod testom je
// produkcijski build (`next start`), pa se hvataju i greške keširanja.
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // Wizard ima spring animacije između koraka - reduced motion ih
    // preskače (aplikacija to poštuje), pa testovi ne čekaju tranzicije
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    // Mobilni viewport namerno: većina klijenata salona zakazuje telefonom
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
