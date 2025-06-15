import * as redis from "@iuioiua/redis";
import type { KvDriver } from "@joyful/kv";

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
}

/**
 * Options for creating a Redis driver.
 */
export interface RedisDriverOptions {
  /**
   * The hostname of the Redis server.
   * @default "127.0.0.1"
   */
  hostname?: string;
  /**
   * The port of the Redis server.
   * @default 6379
   */
  port?: number;
}

/**
 * Creates a new Redis driver.
 * @param options The options for creating the driver.
 * @returns A new Redis driver.
 *
 * > [!NOTE] `createRedisDriver` currently only works in Deno and only supports basic tcp transport. More options will be added in the future.
 */
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
