import { defineConfig } from "vitest/config";
import deno from "@deno/vite-plugin";
import { resultPlugin } from "@joyful/result/vite";

export default defineConfig({
  plugins: [deno(), resultPlugin()],
});
