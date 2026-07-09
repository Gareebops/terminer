import { defineConfig } from "vitest/config";

// Integracioni testovi protiv LOKALNOG Supabase stacka (RLS izolacija,
// zaštita od duple rezervacije). Pokretanje: npm run test:integration -
// bez lokalnog stacka se svi preskaču (guard u samim testovima), na CI-ju
// ih pokreće workflow posle `supabase start`.
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
