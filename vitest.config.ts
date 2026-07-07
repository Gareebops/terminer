import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit testovi za čistu logiku (slotovi, raspored, telefon, množina) -
// bez baze i bez browsera. Pokretanje: npm test
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
