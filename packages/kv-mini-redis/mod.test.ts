import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { delay } from "https://deno.land/std@0.224.0/async/delay.ts";
import type { KvDriver } from "jsr:@joyful/kv"; // Import directly from source
import { createRedisDriver, RedisDriverOptions } from "./mod.ts";

// --- Helper to check if Redis is available ---
async function isRedisAvailable(options: RedisDriverOptions = {}): Promise<boolean> {
  try {
    const driver = await createRedisDriver(options);
    await driver.get("ping");
    return true;
  } catch (e) {
    if (e instanceof Error) {
      console.warn(`Redis not available for options: ${JSON.stringify(options)}. Error: ${e.message}`);
    } else {
      console.warn(`Redis not available for options: ${JSON.stringify(options)}. Error: ${String(e)}`);
    }
    return false;
  }
}

const REDIS_HOST = "127.0.0.1";
const REDIS_PORT = 6379;
const REDIS_URL = `redis://${REDIS_HOST}:${REDIS_PORT}`;

const runIntegrationTests = await isRedisAvailable({ hostname: REDIS_HOST, port: REDIS_PORT });
const runPasswordAuthTests = runIntegrationTests && !!Deno.env.get("TEST_REDIS_PASSWORD");
const REDIS_PASSWORD = Deno.env.get("TEST_REDIS_PASSWORD") || "mypassword";
const runDbSelectionTests = runIntegrationTests;

// --- Test Suite ---

// Variable to capture parameters for unit tests
let connectParams: any = null;

// Mock for URL/Option parsing tests
const mockParseOptionsAndSetConnectParams = (options: RedisDriverOptions = {}) => {
  let S_hostname = "127.0.0.1";
  let S_port = 6379;
  let S_password = undefined;
  let S_db = undefined;
  let S_tls = false;

  if (options.url) {
    const url = new URL(options.url);
    S_hostname = url.hostname || "127.0.0.1";
    S_port = url.port ? parseInt(url.port, 10) : 6379; // Default port if missing
    S_password = url.password || undefined;
    if (url.pathname && url.pathname !== "/") {
      const dbNumFromUrl = parseInt(url.pathname.substring(1), 10);
      if (!isNaN(dbNumFromUrl)) {
        S_db = dbNumFromUrl;
      }
    } else if (url.pathname === "/") { // Default to DB 0 if path is just "/"
      S_db = 0;
    }
    if (url.protocol === "rediss:") {
      S_tls = true;
    }
  }

  // Apply explicit options: these override URL-derived values or set initial values if no URL.
  S_hostname = options.hostname !== undefined ? options.hostname : S_hostname;
  S_port = options.port !== undefined ? options.port : S_port;
  S_password = options.password !== undefined ? options.password : S_password;
  S_db = options.db !== undefined ? options.db : S_db;
  S_tls = options.tls !== undefined ? options.tls : S_tls;

  connectParams = {
    hostname: S_hostname,
    port: S_port,
    password: S_password,
    db: S_db,
    tls: S_tls,
  };
};


Deno.test("URL Parsing: Basic URLs", async (t) => {
  await t.step("redis://localhost", () => {
    mockParseOptionsAndSetConnectParams({ url: "redis://localhost" });
    assertEquals(connectParams.hostname, "localhost");
    assertEquals(connectParams.port, 6379);
    assertEquals(connectParams.tls, false);
    assertEquals(connectParams.db, undefined); // No path, so db undefined
  });

  await t.step("redis://localhost:6380", () => {
    mockParseOptionsAndSetConnectParams({ url: "redis://localhost:6380" });
    assertEquals(connectParams.hostname, "localhost");
    assertEquals(connectParams.port, 6380);
  });

  await t.step("redis://user:pass@localhost:6379", () => {
    mockParseOptionsAndSetConnectParams({ url: "redis://user:pass@localhost:6379" });
    assertEquals(connectParams.password, "pass");
    assertEquals(connectParams.hostname, "localhost");
    assertEquals(connectParams.port, 6379);
  });

  await t.step("redis://:password@myhost/", () => {
    mockParseOptionsAndSetConnectParams({ url: "redis://:somepassword@myhost/" });
    assertEquals(connectParams.password, "somepassword");
    assertEquals(connectParams.hostname, "myhost");
    assertEquals(connectParams.port, 6379);
    assertEquals(connectParams.db, 0);
  });

  await t.step("rediss://localhost", () => {
    mockParseOptionsAndSetConnectParams({ url: "rediss://localhost" });
    assertEquals(connectParams.tls, true);
    assertEquals(connectParams.hostname, "localhost");
    assertEquals(connectParams.port, 6379);
  });

  await t.step("redis://localhost/2", () => {
    mockParseOptionsAndSetConnectParams({ url: "redis://localhost/2" });
    assertEquals(connectParams.db, 2);
    assertEquals(connectParams.hostname, "localhost");
    assertEquals(connectParams.port, 6379);
  });
});

Deno.test("Option Precedence", async (t) => {
  await t.step("port override", () => {
    mockParseOptionsAndSetConnectParams({ url: "redis://localhost:6379", port: 6380 });
    assertEquals(connectParams.port, 6380);
  });

  await t.step("password override", () => {
    mockParseOptionsAndSetConnectParams({ url: "redis://user:pass@host", password: "newpass" });
    assertEquals(connectParams.password, "newpass");
  });

  await t.step("db override", () => {
    mockParseOptionsAndSetConnectParams({ url: "redis://host/1", db: 2 });
    assertEquals(connectParams.db, 2);
  });

  await t.step("tls override (redis:// to tls:true)", () => {
    mockParseOptionsAndSetConnectParams({ url: "redis://host", tls: true });
    assertEquals(connectParams.tls, true);
  });

  await t.step("tls override (rediss:// to tls:false)", () => {
    mockParseOptionsAndSetConnectParams({ url: "rediss://host", tls: false });
    assertEquals(connectParams.tls, false);
  });

  await t.step("hostname and port, no URL", () => {
    mockParseOptionsAndSetConnectParams({ hostname: "testhost", port: 1234 });
    assertEquals(connectParams.hostname, "testhost");
    assertEquals(connectParams.port, 1234);
    assertEquals(connectParams.tls, false);
  });

  await t.step("hostname, port, tls, no URL", () => {
    mockParseOptionsAndSetConnectParams({ hostname: "tlsHost", port: 5678, tls: true });
    assertEquals(connectParams.hostname, "tlsHost");
    assertEquals(connectParams.port, 5678);
    assertEquals(connectParams.tls, true);
  });
});


Deno.test({
  name: "Basic KV Operations (Integration)",
  ignore: !runIntegrationTests,
  fn: async (t) => {
    const driver = await createRedisDriver({ url: REDIS_URL });
    const testKey = "test:basic:key";
    const testValue = `val-${Date.now()}`;

    await t.step("set operation", async () => {
      await driver.set(testKey, testValue);
    });

    await t.step("get operation", async () => {
      const value = await driver.get(testKey);
      assertEquals(value, testValue);
    });

    await t.step("delete operation", async () => {
      await driver.delete(testKey);
      const value = await driver.get(testKey);
      assertEquals(value, null);
    });

    await t.step("set with TTL", async () => {
      const ttlKey = "test:ttl:key";
      await driver.set(ttlKey, "some value", 1);
      assertEquals(await driver.get(ttlKey), "some value");
      await delay(1500);
      assertEquals(await driver.get(ttlKey), null);
    });

    await driver.delete(testKey);
  },
});

Deno.test({
  name: "Password Authentication (Integration)",
  ignore: !runPasswordAuthTests,
  fn: async (t) => {
    const driverWithUrl = await createRedisDriver({
      url: `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`,
    });
    const driverWithOption = await createRedisDriver({
      hostname: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
    });

    const testKey = "test:auth:key";
    const testValue = "authValue";

    await t.step("connect with password in URL", async () => {
      await driverWithUrl.set(testKey, testValue);
      assertEquals(await driverWithUrl.get(testKey), testValue);
      await driverWithUrl.delete(testKey);
    });

    await t.step("connect with password option", async () => {
      await driverWithOption.set(testKey, testValue);
      assertEquals(await driverWithOption.get(testKey), testValue);
      await driverWithOption.delete(testKey);
    });

    await assertRejects(
      async () => {
        const badDriver = await createRedisDriver({
          hostname: REDIS_HOST,
          port: REDIS_PORT,
          password: "wrongpassword",
        });
        await badDriver.get("foo");
      },
      Error,
    );
  },
});

Deno.test({
  name: "Database Selection (Integration)",
  ignore: !runDbSelectionTests,
  fn: async (t) => {
    const db1 = 1;
    const db2 = 2;
    const keyInDb1 = "test:db1:key";
    const keyInDb2 = "test:db2:key";
    const value = "dbValue";

    const driverDb1_url = await createRedisDriver({ url: `${REDIS_URL}/${db1}` });
    const driverDb1_opt = await createRedisDriver({ hostname: REDIS_HOST, port: REDIS_PORT, db: db1 });

    const driverDb2_url = await createRedisDriver({ url: `${REDIS_URL}/${db2}` });
    const driverDb2_opt = await createRedisDriver({ hostname: REDIS_HOST, port: REDIS_PORT, db: db2 });

    const driverDefaultDb = await createRedisDriver({ url: REDIS_URL });

    await t.step("set in DB1 (via URL), check isolation", async () => {
      await driverDb1_url.set(keyInDb1, value);
      assertEquals(await driverDb1_url.get(keyInDb1), value);
      assertEquals(await driverDefaultDb.get(keyInDb1), null, "Key should not be in DB0");
      assertEquals(await driverDb2_url.get(keyInDb1), null, "Key should not be in DB2");
      await driverDb1_url.delete(keyInDb1);
    });

    await t.step("set in DB2 (via option), check isolation", async () => {
      await driverDb2_opt.set(keyInDb2, value);
      assertEquals(await driverDb2_opt.get(keyInDb2), value);
      assertEquals(await driverDefaultDb.get(keyInDb2), null, "Key should not be in DB0");
      assertEquals(await driverDb1_opt.get(keyInDb2), null, "Key should not be in DB1"); // Corrected typo here
      await driverDb2_opt.delete(keyInDb2);
    });

    await driverDb1_url.delete(keyInDb1);
    await driverDb1_opt.delete(keyInDb1);
    await driverDb2_url.delete(keyInDb2);
    await driverDb2_opt.delete(keyInDb2);
  },
});

Deno.test({
  name: "TLS Connection (Integration) - Placeholder",
  ignore: true,
  fn: async () => {
    throw new Error("TLS tests not implemented/configured yet.");
  },
});

console.log(`Running tests:
  - Integration tests: ${runIntegrationTests ? "Enabled" : "Disabled (Redis not detected or connection failed)"}
  - Password auth tests: ${runPasswordAuthTests ? "Enabled" : "Disabled (TEST_REDIS_PASSWORD not set or Redis unavailable)"}
  - DB selection tests: ${runDbSelectionTests ? "Enabled" : "Disabled (Redis unavailable)"}
`);
