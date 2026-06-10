import { defineConfig } from "vite";

// Build the API as a Node.js SSR bundle (server-side, no DOM).
export default defineConfig({
  build: {
    ssr: "src/index.ts",
    target: "node22",
    outDir: "dist",
    rollupOptions: {
      output: { entryFileNames: "index.js" },
    },
  },
});
