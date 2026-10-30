import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations("./drizzle"),
          LEGACY_OWNERS: JSON.stringify({ "Mover@Example.Test": "JAREN_D1" }),
          JEV_EMAILS: "Jaren@Example.Test, other@example.test",
          TYPESAFE_API_KEY: "test-key",
        },
      },
    })),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    setupFiles: ["./test/setup.ts"],
  },
});
