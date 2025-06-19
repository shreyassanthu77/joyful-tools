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
 *
 * Configures the Redis connection using a URL string.
 * Example: `redis://username:password@host:port/db`
 *
 * - If the URL scheme is `rediss:`, TLS will be enabled for the connection.
 * - Hostname defaults to `127.0.0.1` if not specified in the URL.
 * - Port defaults to `6379` if not specified in the URL.
 *
 * @param url The Redis connection URL.
 * @returns A promise that resolves to a new KvDriver instance.
 * @remarks This function supports connections in both Deno and Node.js environments.
 */
export async function createRedisDriver(
  url: string,
): Promise<KvDriver<string, RedisClient>>;
/**
 * Creates a new Redis driver.
 *
 * Configures the Redis connection using a `RedisConnectionOptions` object.
 *
 * @param options Optional. The Redis connection options:
 *   - `hostname`: The hostname of the Redis server. Defaults to `"127.0.0.1"`.
 *   - `port`: The port of the Redis server. Defaults to `6379`.
 *   - `tls`: Whether to use TLS for the connection. Defaults to `false`.
 *   - `password`: The password for Redis authentication. No default.
 *   - `db`: The database number to select after connecting. No default.
 * If `options` is not provided, the driver attempts to connect to the default
 * Redis instance (i.e., "127.0.0.1" on port 6379).
 * @returns A promise that resolves to a new KvDriver instance.
 * @remarks This function supports connections in both Deno and Node.js environments.
 */
export async function createRedisDriver(
  options?: RedisConnectionOptions,
): Promise<KvDriver<string, RedisClient>>;
// Implementation for createRedisDriver overloads.
// This signature should not be called directly if using TypeScript; use one of the overloads above.
export async function createRedisDriver(
  optionsOrUrl?: string | RedisConnectionOptions,
): Promise<KvDriver<string, RedisClient>> {
  let currentHostname: string = "127.0.0.1";
  let currentPort: number = 6379;
  let currentUseTls: boolean = false;
  let currentPassword: string | undefined = undefined;
  let currentDb: number | undefined = undefined;

  if (typeof optionsOrUrl === "string") {
    const url = new URL(optionsOrUrl);
    if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
      throw new Error(`Invalid Redis URL scheme: ${url.protocol}`);
    }

    currentHostname = url.hostname || "127.0.0.1"; // Default here is if URL has no hostname
    currentPort = url.port ? parseInt(url.port, 10) : 6379; // Default here is if URL has no port
    currentPassword = url.password || undefined;

    if (url.pathname && url.pathname !== "/") {
      const dbNumFromUrl = parseInt(url.pathname.substring(1), 10);
      if (!isNaN(dbNumFromUrl)) {
        currentDb = dbNumFromUrl;
      }
    }
    currentUseTls = url.protocol === "rediss:";
  } else if (optionsOrUrl) { // It's RedisConnectionOptions
    currentHostname = optionsOrUrl.hostname ?? currentHostname; // Use initial default if property is null/undefined
    currentPort = optionsOrUrl.port ?? currentPort;
    currentUseTls = optionsOrUrl.tls ?? currentUseTls; // Use initial default (false) if property is null/undefined
    currentPassword = optionsOrUrl.password;
    currentDb = optionsOrUrl.db;
  }
  // If optionsOrUrl is undefined, the initial defaults (127.0.0.1:6379, no TLS) are used.

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
