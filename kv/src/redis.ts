import * as redis from "jsr:@iuioiua/redis@1.1.9";
import type { KvDriver } from "./kv.ts";

class RedisDriver implements KvDriver<string, redis.RedisClient> {
  _driver: redis.RedisClient;

  constructor(redisClient: redis.RedisClient) {
    this._driver = redisClient;
  }

  async get(key: string): Promise<string | null> {
    const reply = await this._driver.sendCommand(["GET", key]);
    if (typeof reply === "string") {
      return reply;
    }
    return null;
  }
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    let reply: redis.Reply;
    if (ttlSeconds) {
      if (ttlSeconds < 1) {
        throw new Error("Redis only supports ttlSeconds >= 1");
      }
      reply = await this._driver.sendCommand([
        "SET",
        key,
        value,
        "EX",
        ttlSeconds,
      ]);
    } else {
      reply = await this._driver.sendCommand(["SET", key, value]);
    }
    if (reply !== "OK") {
      throw new Error("Failed to set key in Redis");
    }
  }
  async delete(key: string): Promise<void> {
    await this._driver.sendCommand(["DEL", key]);
  }
  clear(prefix: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export interface RedisDriverOptions {
  hostname?: string;
  port?: number;
}

export async function createRedisDriver(
  options: RedisDriverOptions = {},
): Promise<KvDriver<string, redis.RedisClient>> {
  const { hostname = "127.0.0.1", port = 6379 } = options;
  if (!("Deno" in globalThis)) {
    throw new Error("Only supported in Deno for now");
  }
  const redisClient = await Deno.connect({ hostname, port, transport: "tcp" });
  const client = new redis.RedisClient(redisClient);
  return new RedisDriver(client);
}
