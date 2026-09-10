import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        hr: resolve(root, "hr.html"),
        threshold: resolve(root, "threshold.html"),
        critical: resolve(root, "critical.html"),
        vo2: resolve(root, "vo2.html"),
        nodevice: resolve(root, "nodevice.html"),
        strength: resolve(root, "strength.html"),
        fuel: resolve(root, "fuel.html"),
        function: resolve(root, "function.html"),
        durability: resolve(root, "durability.html"),
      },
    },
  },
});
