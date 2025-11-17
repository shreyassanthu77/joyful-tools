import { defineConfig } from "vite";
import { pipePlugin } from "@joyful/pipe/vite";

export default defineConfig({
  plugins: [pipePlugin()],
  root: import.meta.dirname,
  appType: "custom",
  build: {
    rollupOptions: {
      input: ["./example.ts"],
    },
  },
});
