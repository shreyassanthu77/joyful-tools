import * as redis from "@iuioiua/redis";
import type { KvDriver } from "@joyful/kv";
import { connect as connectNetSocket, Socket as NetSocket } from "node:net";
import { connect as connectTlsSocket, TLSSocket as TlsSocket } from "node:tls";
import { Readable, Writable } from "node:stream";

type Conn = Deno.TcpConn | Deno.TlsConn | NetSocket | TlsSocket;
class RedisClient extends redis.RedisClient {
  #connection: Conn;
  constructor(
    stream: ConstructorParameters<typeof redis.RedisClient>[0],
    conn: Conn,
  ) {
    super(stream);
    this.#connection = conn;
  }

  close() {
    try {
      const conn = this.#connection;
      if (conn instanceof NetSocket || conn instanceof TlsSocket) {
        conn.destroy();
      } else {
        conn.close();
      }
    } catch (e) {
      console.error(e);
    }
  }
}

class RedisDriver implements KvDriver<string, RedisClient> {
  _driver: RedisClient;

  constructor(redisClient: RedisClient) {
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
 * Options for configuring a Redis connection directly.
 */
export interface RedisConnectionOptions {
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
  /**
   * Whether to use TLS for the connection.
   * @default false
   */
  tls?: boolean;
  /**
   * The password for Redis authentication.
   */
  password?: string;
  /**
   * The database number to select after connecting.
   */
  db?: number;
}

/**
 * Creates a new Redis driver.
 * @param options The options for creating the driver. This can be a URL string
 * (e.g., `redis://username:password@host:port/db`) or a {@link RedisConnectionOptions} object.
 * If a URL string is provided, it's the sole source of configuration.
 * If an options object is provided, `hostname` defaults to "127.0.0.1" and `port` to 6379.
 * @returns A promise that resolves to a new KvDriver instance configured for Redis.
 *
 * This function supports connections to Redis in both Deno and Node.js environments.
 */
export async function createRedisDriver(
  options: string | RedisConnectionOptions,
): Promise<KvDriver<string, RedisClient>> {
  let currentHostname: string;
  let currentPort: number;
  let currentUseTls: boolean;
  let currentPassword: string | undefined;
  let currentDb: number | undefined;

  if (typeof options === "string") {
    const url = new URL(options);
    if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
      throw new Error(`Invalid Redis URL scheme: ${url.protocol}`);
    }

    currentHostname = url.hostname || "127.0.0.1";
    currentPort = url.port ? parseInt(url.port, 10) : 6379;
    currentPassword = url.password || undefined;

    if (url.pathname && url.pathname !== "/") {
      const dbNumFromUrl = parseInt(url.pathname.substring(1), 10);
      if (!isNaN(dbNumFromUrl)) {
        currentDb = dbNumFromUrl;
      }
    }
    currentUseTls = url.protocol === "rediss:";
  } else {
    currentHostname = options.hostname ?? "127.0.0.1";
    currentPort = options.port ?? 6379;
    currentUseTls = options.tls === true;
    currentPassword = options.password;
    currentDb = options.db;
  }

  let stream: ConstructorParameters<typeof redis.RedisClient>[0];
  let conn: Conn;

  if ("Deno" in globalThis) {
    if (currentUseTls) {
      conn = await Deno.connectTls({
        hostname: currentHostname,
        port: currentPort,
      });
      stream = conn;
    } else {
      conn = await Deno.connect({
        hostname: currentHostname,
        port: currentPort,
        transport: "tcp",
      });
      stream = conn;
    }
  } else {
    let nodeSocket: NetSocket | TlsSocket;
    if (currentUseTls) {
      nodeSocket = connectTlsSocket({
        host: currentHostname,
        port: currentPort,
        servername: currentHostname,
      });
    } else {
      nodeSocket = connectNetSocket({
        host: currentHostname,
        port: currentPort,
      });
    }

    const readable = Readable.toWeb(nodeSocket) as ReadableStream<Uint8Array>;
    const writable = Writable.toWeb(nodeSocket) as WritableStream<Uint8Array>;
    stream = { readable, writable };
    conn = nodeSocket;
  }

  const client = new RedisClient(stream, conn);

  if (currentPassword) {
    await client.sendCommand(["AUTH", currentPassword]);
  }
  if (currentDb !== undefined) {
    await client.sendCommand(["SELECT", currentDb.toString()]);
  }

  return new RedisDriver(client);
}
