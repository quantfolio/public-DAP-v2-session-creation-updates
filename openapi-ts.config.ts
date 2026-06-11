import { defineConfig } from "@hey-api/openapi-ts";

// Regenerate with: pnpm gen
// Source spec is fetched from the DeepAlpha Public API (not committed).
export default defineConfig({
  input: "https://api.test.deepalpha.dev/openapi.json",
  output: {
    path: "src/client",
  },
  plugins: [
    // Base URL + auth are configured at runtime in src/api.ts via client.setConfig().
    "@hey-api/client-fetch",
    "@hey-api/typescript",
    {
      name: "@hey-api/sdk",
      asClass: false,
    },
  ],
});
