import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  fmt: { printWidth: 80, ignorePatterns: ["drizzle", "pnpm-lock.yaml"] },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true },
  },
  plugins: lazyPlugins(() => [react(), tailwindcss(), cloudflare()]),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
