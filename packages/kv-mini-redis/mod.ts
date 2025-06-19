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
 * Options for creating a Redis driver.
 *
 * The driver can be configured using a URL string or by providing individual options.
 * If `url` is provided, it will be parsed for connection parameters. Explicit options
 * like `hostname`, `port`, `password`, `db`, and `tls` can override the values
 * parsed from the URL.
 *
 * - `hostname` defaults to "127.0.0.1".
 * - `port` defaults to 6379.
 * - `tls: true` is equivalent to using the `rediss:` protocol in the URL. If `url` uses
 *   `rediss:`, TLS will be enabled automatically.
 * - `password` and `db` (database number) can also be provided directly, taking
 *   precedence over values from the URL.
 */
export interface RedisDriverOptions {
  /**
   * The URL of the Redis server (e.g., `redis://username:password@host:port/db`).
   * Values from this URL can be individually overridden by other options.
   */
  url?: string;
  /**
   * The hostname of the Redis server.
   * Overrides hostname from `url` if both are provided.
   * @default "127.0.0.1"
   */
  hostname?: string;
  /**
   * The port of the Redis server.
   * Overrides port from `url` if both are provided.
   * @default 6379
   */
  port?: number;
  /**
   * Whether to use TLS for the connection.
   * If `url` uses the `rediss:` scheme, TLS is enabled by default.
   * This option can explicitly enable or disable TLS, overriding the URL scheme.
   * @default false
   */
  tls?: boolean;
  /**
   * The password for Redis authentication.
   * Takes precedence over a password embedded in the `url`.
   */
  password?: string;
  /**
   * The database number to select after connecting.
   * Takes precedence over a database number in the `url` path.
   */
  db?: number;
}

/**
 * Creates a new Redis driver.
 * @param options The options for creating the driver. See {@link RedisDriverOptions}.
 * @returns A promise that resolves to a new KvDriver instance configured for Redis.
 *
 * This function supports connections to Redis in both Deno and Node.js environments,
 * offering various configuration options including URL strings, hostname/port,
 * TLS, password authentication, and database selection.
 */
export async function createRedisDriver(
  options: RedisDriverOptions = {},
): Promise<KvDriver<string, RedisClient>> {
  const { hostname, port, tls, password, db } = options;

  let currentHostname = "127.0.0.1";
  let currentPort = 6379;
  let currentUseTls = tls === true;
  let currentPassword = password;
  let currentDb = db;

  if (options.url) {
    const url = new URL(options.url);
    if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
      throw new Error(`Invalid Redis URL scheme: ${url.protocol}`);
    }

    currentHostname = (hostname ?? url.hostname) || "127.0.0.1";
    currentPort = port ?? (url.port ? parseInt(url.port, 10) : 6379);
    currentPassword = (password ?? url.password) || undefined;

    if (url.pathname && url.pathname !== "/") {
      const dbNumFromUrl = parseInt(url.pathname.substring(1), 10);
      if (!isNaN(dbNumFromUrl)) {
        currentDb = db ?? dbNumFromUrl;
      }
    }

    if (url.protocol === "rediss:") {
      currentUseTls = true;
    }
    if (tls !== undefined) {
      currentUseTls = tls;
    }
  } else {
    currentHostname = hostname ?? "127.0.0.1";
    currentPort = port ?? 6379;
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
