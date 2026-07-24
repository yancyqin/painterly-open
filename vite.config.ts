import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const itch = mode === "itch";
  return {
    // itch extracts the ZIP under a directory, so every emitted asset must use
    // a relative URL. The normal Worker build keeps the production root base.
    base: itch ? "./" : "/",
    build: {
      assetsInlineLimit: 0,
      sourcemap: !itch,
      emptyOutDir: true,
      rollupOptions: {
        // The standalone distribution intentionally exposes one game entry.
        // The visual-effect studies are development tools, never itch content.
        input: itch ? ["index.html"] : ["index.html", "live-6a.html", "live-1a.html", "live-1b.html"],
      },
    },
  };
});
