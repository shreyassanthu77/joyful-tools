import { createMemoryDriver } from "@joyful/kv/memory";
import { createDenoDriver } from "@joyful/kv/deno-kv";
import { createRedisDriver } from "@joyful/kv-mini-redis";
import { testDriver } from "./test-util.ts";

testDriver("memory", createMemoryDriver());
testDriver(
  "deno",
  createDenoDriver({
    kv: await Deno.openKv(":memory:"),
  }),
);
testDriver("redis", await createRedisDriver());
