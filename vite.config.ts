import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackBuildConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  plugins: [
    ...tanstackBuildConfig(),
    react(),
    tsconfigPaths()
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
