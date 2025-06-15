import type { KvDriver } from "@joyful/kv";
import { assertEquals } from "jsr:@std/assert";

export function testDriver<Driver extends KvDriver<unknown>>(
  name: string,
  driver: Driver,
) {
  Deno.test(`Driver: ${name}`, async (t) => {
    await t.step("set", async () => {
      for (let i = 0; i < 10; i++) {
        await driver.set(`key${i}`, `value${i}`);
      }
    });

    await t.step("get", async () => {
      for (let i = 0; i < 10; i++) {
        const value = await driver.get(`key${i}`);
        assertEquals(value, `value${i}`);
      }
    });

    await t.step("set with ttl", async () => {
      const ttl = name === "memory" ? 0.2 : 1; // redis doesn't support ttl < 1 second
      for (let i = 0; i < 10; i++) {
        await driver.set(`key${i}`, `value${i}`, ttl);
      }
      for (let i = 0; i < 10; i++) {
        const value = await driver.get(`key${i}`);
        assertEquals(value, `value${i}`, "value should be set");
      }
      await new Promise((resolve) => setTimeout(resolve, ttl * 1000));
      for (let i = 0; i < 10; i++) {
        const value = await driver.get(`key${i}`);
        assertEquals(value, null);
      }
    });

    await t.step("delete", async () => {
      for (let i = 0; i < 10; i++) {
        await driver.delete(`key${i}`);
      }
      for (let i = 0; i < 10; i++) {
        const value = await driver.get(`key${i}`);
        assertEquals(value, null);
      }
    });

    if (driver.clear) {
      await t.step("clear", async () => {
        for (let i = 0; i < 10; i++) {
          await driver.set(`key${i}`, `value${i}`);
        }
        for (let i = 0; i < 10; i++) {
          await driver.set(`other${i}`, `value${i}`);
        }
        await driver.clear!("key");
        for (let i = 0; i < 10; i++) {
          const value = await driver.get(`key${i}`);
          assertEquals(value, null);
        }
        for (let i = 0; i < 10; i++) {
          const value = await driver.get(`other${i}`);
          assertEquals(value, `value${i}`);
        }
      });
    }
  });
}
