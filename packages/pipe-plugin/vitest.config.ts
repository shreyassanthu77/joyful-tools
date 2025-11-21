import { defineConfig } from "vitest/config";
import deno from "@deno/vite-plugin";
import { pipePlugin } from "./src/mod.ts";

export default defineConfig({
  plugins: [deno(), pipePlugin()],
});
