import { assertEquals, assertRejects } from "jsr:@std/assert";
import { delay } from "jsr:@std/async";
import { createRedisDriver, type RedisConnectionOptions } from "./mod.ts";

async function isRedisAvailable(
  config: string | RedisConnectionOptions = {},
): Promise<boolean> {
  try {
    let driver;
    if (typeof config === 'string') {
      driver = await createRedisDriver(config); // Matches string overload
    } else {
      // config is RedisConnectionOptions or {}
      // If config is an empty object {}, provide default hostname and port
      const effectiveOptions = Object.keys(config).length === 0
                               ? { hostname: REDIS_HOST, port: REDIS_PORT }
                               : config;
      driver = await createRedisDriver(effectiveOptions); // Matches RedisConnectionOptions overload
    }
    await driver.get("ping");
    driver._driver.close();
    return true;
  } catch (e) {
    if (e instanceof Error) {
      console.warn(
        `Redis not available for options: ${JSON.stringify(config)}. Error: ${e.message}`,
      );
    } else {
      console.warn(
        `Redis not available for options: ${JSON.stringify(config)}. Error: ${String(e)}`,
      );
    }
    return false;
  }
}

const REDIS_HOST = "127.0.0.1";
const REDIS_PORT = 6379;
const REDIS_URL = `redis://${REDIS_HOST}:${REDIS_PORT}`;

const runIntegrationTests = await isRedisAvailable({
  hostname: REDIS_HOST,
  port: REDIS_PORT,
});
const runPasswordAuthTests =
  runIntegrationTests && !!Deno.env.get("TEST_REDIS_PASSWORD");
const REDIS_PASSWORD = Deno.env.get("TEST_REDIS_PASSWORD") || "mypassword";
const runDbSelectionTests = runIntegrationTests;

const TEST_REDIS_TLS_URL = Deno.env.get("TEST_REDIS_TLS_URL"); // e.g., rediss://my-tls-redis:6379
const TEST_REDIS_TLS_HOST = Deno.env.get("TEST_REDIS_TLS_HOST"); // e.g., my-tls-redis
const TEST_REDIS_TLS_PORT = Deno.env.get("TEST_REDIS_TLS_PORT")
  ? parseInt(Deno.env.get("TEST_REDIS_TLS_PORT")!, 10)
  : undefined;

const runTlsTests =
  runIntegrationTests &&
  !!TEST_REDIS_TLS_URL &&
  !!TEST_REDIS_TLS_HOST &&
  !!TEST_REDIS_TLS_PORT &&
  await isRedisAvailable(TEST_REDIS_TLS_URL);

// --- Test Suite ---

Deno.test({
  name: "createRedisDriver API tests",
  ignore: !runIntegrationTests,
  fn: async (t) => {
    await t.step("connect with URL string", async () => {
      const driver = await createRedisDriver(REDIS_URL);
      await driver.get("ping"); // Check connection
      driver._driver.close();
    });

    await t.step("connect with options object (hostname, port)", async () => {
      const driver = await createRedisDriver({
        hostname: REDIS_HOST,
        port: REDIS_PORT,
      });
      await driver.get("ping"); // Check connection
      driver._driver.close();
    });

    await t.step(
      "connect with options object (all params - no TLS)",
      async () => {
        // This test uses existing REDIS_PASSWORD and a selectable DB
        // It assumes the main Redis instance (REDIS_URL) can handle this.
        const driver = await createRedisDriver({
          hostname: REDIS_HOST,
          port: REDIS_PORT,
          password: runPasswordAuthTests ? REDIS_PASSWORD : undefined, // Use password if available for testing
          db: runDbSelectionTests ? 1 : undefined, // Use DB 1 if available for testing
          tls: false,
        });
        await driver.get("ping");
        // If db selection was tested, try setting a key to confirm context
        if (runDbSelectionTests) {
          await driver.set("api-test-db1", "val");
          // Ideally, check this key isn't in DB0, but that's more involved here.
          await driver.delete("api-test-db1");
        }
        driver._driver.close();
      },
    );

    await t.step("throws error for invalid URL scheme", async () => {
      await assertRejects(
        async () => {
          await createRedisDriver("http://localhost:6379");
        },
        Error,
        "Invalid Redis URL scheme: http:",
      );
    });

    await t.step("connect with empty options (defaults)", async () => {
      // isRedisAvailable already tests createRedisDriver({}) implicitly by its default param
      // This step makes it explicit for API testing.
      // It relies on REDIS_HOST and REDIS_PORT (127.0.0.1:6379) being available.
      const driver = await createRedisDriver({});
      await driver.get("ping");
      driver._driver.close();
    });

    await t.step({
      name: "connect with rediss:// URL (TLS)",
      ignore: !runTlsTests,
      fn: async () => {
        const driver = await createRedisDriver(TEST_REDIS_TLS_URL!);
        await driver.get("ping");
        driver._driver.close();
      },
    });

    await t.step({
      name: "connect with tls:true option (TLS)",
      ignore: !runTlsTests,
      fn: async () => {
        const driver = await createRedisDriver({
          hostname: TEST_REDIS_TLS_HOST!,
          port: TEST_REDIS_TLS_PORT!,
          tls: true,
        });
        await driver.get("ping");
        driver._driver.close();
      },
    });
  },
});

Deno.test({
  name: "Basic KV Operations (Integration)",
  ignore: !runIntegrationTests,
  fn: async (t) => {
    const driver = await createRedisDriver(REDIS_URL);
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
    driver._driver.close();
  },
});

Deno.test({
  name: "Password Authentication (Integration)",
  ignore: !runPasswordAuthTests,
  fn: async (t) => {
    const driverWithUrl = await createRedisDriver(
      `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`,
    );
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

    await assertRejects(async () => {
      const badDriver = await createRedisDriver({
        hostname: REDIS_HOST,
        port: REDIS_PORT,
        password: "wrongpassword",
      });
      await badDriver.get("foo");
    }, Error);

    driverWithOption._driver.close();
    driverWithUrl._driver.close();
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

    const driverDb1_url = await createRedisDriver(`${REDIS_URL}/${db1}`);
    const driverDb1_opt = await createRedisDriver({
      hostname: REDIS_HOST,
      port: REDIS_PORT,
      db: db1,
    });

    const driverDb2_url = await createRedisDriver(`${REDIS_URL}/${db2}`);
    const driverDb2_opt = await createRedisDriver({
      hostname: REDIS_HOST,
      port: REDIS_PORT,
      db: db2,
    });

    const driverDefaultDb = await createRedisDriver(REDIS_URL);

    await t.step("set in DB1 (via URL), check isolation", async () => {
      await driverDb1_url.set(keyInDb1, value);
      assertEquals(await driverDb1_url.get(keyInDb1), value);
      assertEquals(
        await driverDefaultDb.get(keyInDb1),
        null,
        "Key should not be in DB0",
      );
      assertEquals(
        await driverDb2_url.get(keyInDb1),
        null,
        "Key should not be in DB2",
      );
      await driverDb1_url.delete(keyInDb1);
    });

    await t.step("set in DB2 (via option), check isolation", async () => {
      await driverDb2_opt.set(keyInDb2, value);
      assertEquals(await driverDb2_opt.get(keyInDb2), value);
      assertEquals(
        await driverDefaultDb.get(keyInDb2),
        null,
        "Key should not be in DB0",
      );
      assertEquals(
        await driverDb1_opt.get(keyInDb2),
        null,
        "Key should not be in DB1",
      ); // Corrected typo here
      await driverDb2_opt.delete(keyInDb2);
    });

    await driverDb1_url.delete(keyInDb1);
    await driverDb1_opt.delete(keyInDb1);
    await driverDb2_url.delete(keyInDb2);
    await driverDb2_opt.delete(keyInDb2);

    driverDb1_url._driver.close();
    driverDb1_opt._driver.close();
    driverDb2_url._driver.close();
    driverDb2_opt._driver.close();
    driverDefaultDb._driver.close();
  },
});

console.log(`Running tests:
  - Integration tests: ${runIntegrationTests ? "Enabled" : "Disabled (Redis not detected or connection failed)"}
  - Password auth tests: ${runPasswordAuthTests ? "Enabled" : "Disabled (TEST_REDIS_PASSWORD not set or Redis unavailable)"}
  - DB selection tests: ${runDbSelectionTests ? "Enabled" : "Disabled (Redis unavailable)"}
  - TLS tests: ${runTlsTests ? "Enabled" : "Disabled (TEST_REDIS_TLS_URL, TEST_REDIS_TLS_HOST, or TEST_REDIS_TLS_PORT not set, or TLS Redis unavailable)"}
`);
