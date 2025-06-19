import { createMemoryDriver } from "@joyful/kv/memory";
import { createDenoDriver } from "@joyful/kv/deno-kv";
import { createRedisDriver } from "@joyful/kv-mini-redis";
import { createNatsDriver } from "@joyful/kv-nats";
import { connect as natsDenoConnect } from "jsr:@nats-io/transport-deno";
import { connect as natsNodeConnect } from "npm:@nats-io/transport-node";
import { testDriver } from "./test-util.ts";

testDriver("memory", createMemoryDriver());

testDriver(
  "deno",
  async () =>
    createDenoDriver({
      kv: await Deno.openKv(":memory:"),
    }),
  (d) => d._driver.close(),
);

testDriver("redis", await createRedisDriver());

testDriver(
  "nats-deno",
  async () =>
    createNatsDriver({
      conn: await natsDenoConnect({}),
    }),
  // @ts-ignore ..
  (d) => d._driver.js.nc.close(),
);

testDriver(
  "nats-node",
  async () =>
    createNatsDriver({
      conn: await natsNodeConnect({}),
    }),
  // @ts-ignore ..
  (d) => d._driver.js.nc.close(),
);
