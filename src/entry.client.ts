/// <reference lib="dom" />
import index from "./index.svelte";
import { hydrate } from "svelte";

const app = document.getElementById("app");
if (!app) throw new Error("No app found");
hydrate(index, {
  target: app,
});
