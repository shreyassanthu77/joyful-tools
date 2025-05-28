import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { joyful } from "./plugins/joyful.ts";

export default defineConfig({
  plugins: [
    joyful(),
    svelte({
      compilerOptions: {
        hmr: true,
      },
    }),
  ],
});
