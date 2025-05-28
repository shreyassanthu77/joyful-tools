import { PluginOption } from "vite";
import inspect from "vite-plugin-inspect";
import { joyfulDev } from "./joyful-dev.ts";

export function joyful(): PluginOption {
  return [
    {
      name: "vite-plugin-joyful-setup",
      enforce: "pre",
      config() {
        return {
          appType: "custom",
        };
      },
      configureServer: joyfulDev,
    },
    inspect({}),
  ];
}
