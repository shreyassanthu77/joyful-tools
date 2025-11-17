import { defineConfig } from "vitest/config";
import deno from "@deno/vite-plugin";
import { pipePlugin } from "@joyful/pipe/vite";

export default defineConfig({
  plugins: [deno(), pipePlugin()],
});
