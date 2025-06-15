import { createMemoryDriver } from "@joyful/kv/memory";
import { createDenoDriver } from "@joyful/kv/deno-kv";
import { createRedisDriver } from "./redis.ts";
import { testDriver } from "./test-util.ts";

testDriver("memory", createMemoryDriver());
testDriver(
  "deno",
  createDenoDriver({
    kv: await Deno.openKv(":memory:"),
  }),
);
testDriver("redis", await createRedisDriver());
