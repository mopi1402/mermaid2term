import path from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const FIXTURES = path.resolve(import.meta.dirname, "../../fixtures");
const CORPUS = path.resolve(import.meta.dirname, "src/corpus.ts");
const SOURCE = ".mmd";

/** A fixture added to the repository shows up in the list: `import.meta.glob` is frozen at transform time otherwise. */
const liveCorpus = (): Plugin => ({
  name: "live-corpus",
  configureServer(server) {
    server.watcher.add(FIXTURES);
    const reload = (file: string) => {
      if (!file.endsWith(SOURCE)) return;
      const module = server.moduleGraph.getModuleById(CORPUS);
      if (module === undefined) return;
      server.moduleGraph.invalidateModule(module);
      server.ws.send({ type: "full-reload" });
    };
    server.watcher.on("add", reload);
    server.watcher.on("unlink", reload);
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), liveCorpus()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // The library is read at the SOURCE, not from `dist/`, so a renderer change shows without a rebuild.
      "@tayomi/mermaid2term": path.resolve(import.meta.dirname, "../../src/index.ts"),
    },
  },
  server: {
    port: 4747,
    strictPort: true,
    // File system events do not reach the watcher on this machine: without polling Vite sees no change at all.
    watch: { usePolling: true, interval: 250 },
  },
  test: {
    setupFiles: ["tests/setup.ts"],
    // The grid is checked on the whole corpus in one test.
    testTimeout: 60_000,
  },
});
