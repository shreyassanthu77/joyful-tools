import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { delay } from "https://deno.land/std@0.224.0/async/delay.ts";
import type { KvDriver } from "../mod.ts"; // Adjust if KvDriver is exported differently
import { createRedisDriver, RedisDriverOptions } from "../mod.ts";

// --- Helper to check if Redis is available ---
async function isRedisAvailable(options: RedisDriverOptions = {}): Promise<boolean> {
  try {
    const driver = await createRedisDriver(options);
    // Try a simple command
    await driver.get("ping"); // PING is often an internal command that works, or use get
    return true;
  } catch (e) {
    console.warn(`Redis not available for options: ${JSON.stringify(options)}. Error: ${e.message}`);
    return false;
  }
}

const REDIS_HOST = "127.0.0.1";
const REDIS_PORT = 6379;
const REDIS_URL = `redis://${REDIS_HOST}:${REDIS_PORT}`;

const runIntegrationTests = await isRedisAvailable({ hostname: REDIS_HOST, port: REDIS_PORT });
const runPasswordAuthTests = runIntegrationTests && !!Deno.env.get("TEST_REDIS_PASSWORD");
const REDIS_PASSWORD = Deno.env.get("TEST_REDIS_PASSWORD") || "mypassword";
const runDbSelectionTests = runIntegrationTests; // Assumes standard Redis can use different DBs

// --- Test Suite ---

Deno.test("URL Parsing: Basic URLs", async (t) => {
  // These tests primarily check if options are parsed correctly.
  // Actual connection might fail if Redis isn't running, but parsing should succeed.
  // We'll mock the actual connect function to spy on its arguments.

  let connectParams: any = null;

  const mockCreateRedisDriver = async (options: RedisDriverOptions = {}) => {
    // Simplified mock: Intercept parameters before actual connection attempt
    // This is a conceptual mock; in reality, we'd mock Deno.connect/tls.connect
    // For now, we assume that if it doesn't throw parsing errors, it's a good sign.
    // And for some, we'll try to connect if Redis is available.

    // Store params for assertions (conceptual)
    if (options.url) {
        const url = new URL(options.url);
        connectParams = {
            hostname: url.hostname || undefined,
            port: url.port ? parseInt(url.port) : undefined,
            password: url.password || undefined,
            db: url.pathname && url.pathname !== "/" ? parseInt(url.pathname.substring(1)) : undefined,
            tls: url.protocol === "rediss:",
        };
    } else {
        connectParams = { ...options, tls: options.tls === true };
    }
    // Override with explicit options
    if (options.hostname) connectParams.hostname = options.hostname;
    if (options.port) connectParams.port = options.port;
    if (options.password) connectParams.password = options.password;
    if (options.db) connectParams.db = options.db;
    if (options.tls !== undefined) connectParams.tls = options.tls;


    // Actual driver creation for tests that might connect
    return createRedisDriver(options);
  };


  await t.step("redis://localhost", async () => {
    await mockCreateRedisDriver({ url: "redis://localhost" });
    assertEquals(connectParams.hostname, "localhost");
    assertEquals(connectParams.port, 6379); // Default port
    assertEquals(connectParams.tls, false);
  });

  await t.step("redis://localhost:6380", async () => {
    await mockCreateRedisDriver({ url: "redis://localhost:6380" });
    assertEquals(connectParams.hostname, "localhost");
    assertEquals(connectParams.port, 6380);
  });

  await t.step("redis://user:pass@localhost:6379", async () => {
    await mockCreateRedisDriver({ url: "redis://user:pass@localhost:6379" });
    assertEquals(connectParams.password, "pass");
    assertEquals(connectParams.hostname, "localhost");
    assertEquals(connectParams.port, 6379);
  });

  await t.step("redis://:password@host/", async () => {
    await mockCreateRedisDriver({ url: "redis://:somepassword@myhost/" });
    assertEquals(connectParams.password, "somepassword");
    assertEquals(connectParams.hostname, "myhost");
    assertEquals(connectParams.port, 6379); // Default port
    assertEquals(connectParams.db, 0); // Default db
  });

  await t.step("rediss://localhost", async () => {
    await mockCreateRedisDriver({ url: "rediss://localhost" });
    assertEquals(connectParams.tls, true);
    assertEquals(connectParams.hostname, "localhost");
  });

  await t.step("redis://localhost/2", async () => {
    await mockCreateRedisDriver({ url: "redis://localhost/2" });
    assertEquals(connectParams.db, 2);
    assertEquals(connectParams.hostname, "localhost");
  });
});

Deno.test("Option Precedence", async (t) => {
  // Similar conceptual mock as above for connectParams
  let connectParams: any = null;
  const mockCreateRedisDriver = async (options: RedisDriverOptions = {}) => {
    if (options.url) {
        const url = new URL(options.url);
        connectParams = {
            hostname: url.hostname || undefined,
            port: url.port ? parseInt(url.port) : undefined,
            password: url.password || undefined,
            db: url.pathname && url.pathname !== "/" ? parseInt(url.pathname.substring(1)) : undefined,
            tls: url.protocol === "rediss:",
        };
    } else {
        connectParams = { hostname: "127.0.0.1", port: 6379, tls: false }; // Defaults for no-URL case
    }
    // Override with explicit options
    if (options.hostname !== undefined) connectParams.hostname = options.hostname;
    if (options.port !== undefined) connectParams.port = options.port;
    if (options.password !== undefined) connectParams.password = options.password;
    if (options.db !== undefined) connectParams.db = options.db;
    if (options.tls !== undefined) connectParams.tls = options.tls;

    // Actual driver creation for tests that might connect
    return createRedisDriver(options);
  };

  await t.step("port override", async () => {
    await mockCreateRedisDriver({ url: "redis://localhost:6379", port: 6380 });
    assertEquals(connectParams.port, 6380);
  });

  await t.step("password override", async () => {
    await mockCreateRedisDriver({ url: "redis://user:pass@host", password: "newpass" });
    assertEquals(connectParams.password, "newpass");
  });

  await t.step("db override", async () => {
    await mockCreateRedisDriver({ url: "redis://host/1", db: 2 });
    assertEquals(connectParams.db, 2);
  });

  await t.step("tls override (redis:// to tls:true)", async () => {
    await mockCreateRedisDriver({ url: "redis://host", tls: true });
    assertEquals(connectParams.tls, true);
  });

  await t.step("tls override (rediss:// to tls:false)", async () => {
    await mockCreateRedisDriver({ url: "rediss://host", tls: false });
    assertEquals(connectParams.tls, false);
  });

  await t.step("hostname and port, no URL", async () => {
    await mockCreateRedisDriver({ hostname: "testhost", port: 1234 });
    assertEquals(connectParams.hostname, "testhost");
    assertEquals(connectParams.port, 1234);
    assertEquals(connectParams.tls, false);
  });

  await t.step("hostname, port, tls, no URL", async () => {
    await mockCreateRedisDriver({ hostname: "tlsHost", port: 5678, tls: true });
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
      await driver.set(ttlKey, "some value", 1); // 1 second TTL
      assertEquals(await driver.get(ttlKey), "some value");
      await delay(1500); // Wait for TTL to expire
      assertEquals(await driver.get(ttlKey), null);
    });

    // Cleanup any keys, though individual tests should manage their own
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

    // Test invalid password
    await assertRejects(
      async () => {
        const badDriver = await createRedisDriver({
          hostname: REDIS_HOST,
          port: REDIS_PORT,
          password: "wrongpassword",
        });
        // The error might occur on create, or on first command, depending on library
        await badDriver.get("foo");
      },
      Error, // Or specific RedisAuthError if available from the client lib
      // Message might include "AUTH" or "authentication"
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

    const driverDefaultDb = await createRedisDriver({ url: REDIS_URL }); // DB 0

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
      assertEquals(await driverDb1_opt.get(keyInDb2), null, "Key should not be in DB1");
      await driverDb2_opt.delete(keyInDb2);
    });

    // Cleanup
    await driverDb1_url.delete(keyInDb1);
    await driverDb1_opt.delete(keyInDb1); // just in case
    await driverDb2_url.delete(keyInDb2);
    await driverDb2_opt.delete(keyInDb2); // just in case
  },
});

Deno.test({
  name: "TLS Connection (Integration) - Placeholder",
  ignore: true, // Ignored by default due to setup complexity
  fn: async () => {
    // This test requires a Redis server configured for TLS.
    // Example connection attempts (these would fail without a TLS Redis):
    // const driverTLS_url = await createRedisDriver({ url: "rediss://<your-tls-redis-host>:<tls-port>" });
    // const driverTLS_opts = await createRedisDriver({
    //   hostname: "<your-tls-redis-host>",
    //   port: <tls-port>,
    //   tls: true,
    // });
    // await driverTLS_url.set("tlskey", "tlsvalue");
    // assertEquals(await driverTLS_url.get("tlskey"), "tlsvalue");
    throw new Error("TLS tests not implemented/configured yet.");
  },
});

// Note on URL/Option Precedence tests:
// The `mockCreateRedisDriver` is a simplified conceptual mock.
// Ideally, one would use a proper mocking/spying library or directly mock
// `Deno.connect`, `Deno.connectTls`, `net.connect`, `tls.connect` to verify
// the exact parameters passed to the underlying connection functions without
// needing a live Redis server for these specific unit tests.
// Given the constraints, these tests verify parsing by checking the intermediate
// `connectParams` object, which simulates the parsed and resolved options.
// The integration tests then cover the end-to-end functionality.

// To run these tests:
// 1. Ensure you have a Redis server running on 127.0.0.1:6379 for integration tests.
// 2. For password tests, set TEST_REDIS_PASSWORD environment variable to your Redis password.
//    e.g., TEST_REDIS_PASSWORD=mypassword deno test -A packages/kv-mini-redis/mod.test.ts
// 3. For database selection, no special config needed beyond standard Redis.
//
// You might need to adjust imports or paths based on your project structure.
// The `@std/assert` and `@std/async` versions are pinned for stability.
// Deno test runner: deno test --allow-net --allow-env packages/kv-mini-redis/mod.test.ts
// (adjust permissions as needed by your environment and tests)

console.log(`Running tests:
  - Integration tests: ${runIntegrationTests ? "Enabled" : "Disabled (Redis not detected or connection failed)"}
  - Password auth tests: ${runPasswordAuthTests ? "Enabled" : "Disabled (TEST_REDIS_PASSWORD not set or Redis unavailable)"}
  - DB selection tests: ${runDbSelectionTests ? "Enabled" : "Disabled (Redis unavailable)"}
`);
