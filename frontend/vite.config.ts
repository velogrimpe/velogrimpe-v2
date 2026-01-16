import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],

  build: {
    outDir: "../public_html/dist",
    emptyOutDir: true,

    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/apps/main.ts"),
        // 'map' is built separately with esbuild for IIFE format (see build-map.ts)
        "carte-filters": resolve(__dirname, "src/apps/carte-filters.ts"),
        "carte-info": resolve(__dirname, "src/apps/carte-info.ts"),
        "carte-search": resolve(__dirname, "src/apps/carte-search.ts"),
        tableau: resolve(__dirname, "src/apps/tableau.ts"),
        utils: resolve(__dirname, "src/apps/utils.ts"),
        "ajout-velo": resolve(__dirname, "src/apps/ajout-velo.ts"),
        "ajout-falaise": resolve(__dirname, "src/apps/ajout-falaise.ts"),
        "ajout-train": resolve(__dirname, "src/apps/ajout-train.ts"),
        "falaise-comment": resolve(__dirname, "src/apps/falaise-comment.ts"),
        "falaise-rose": resolve(__dirname, "src/apps/falaise-rose.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
      external: [/^\/images\//, /^\/symbols\//],
    },

    manifest: true,
  },

  server: {
    port: 5173,
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
