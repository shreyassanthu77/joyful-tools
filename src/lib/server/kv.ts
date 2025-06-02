import { openKv } from "@deno/kv";
import { DENO_KV_URL } from "$env/static/private";

export const kv = await openKv(DENO_KV_URL);
