import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import pkg from "@lovable.dev/vite-tanstack-config";

// Resolve the configuration block from the default fallback export
const tanstackBuildConfig = typeof pkg === "function" ? pkg : (pkg as any).default || pkg;

export default defineConfig({
  plugins: [
    ...(typeof tanstackBuildConfig === "function" ? tanstackBuildConfig() : []),
    react(),
    tsconfigPaths()
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
