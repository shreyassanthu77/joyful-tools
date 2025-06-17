import type { KvDriver } from "@joyful/kv";
import { Kvm, type KV, type KvOptions } from "@nats-io/kv";

type Connection = ConstructorParameters<typeof Kvm>[0];

class NatsDriver implements KvDriver<string, Kvm> {
  _driver: Kvm;
  #kvPromise: Promise<KV>;
  #kv!: KV;

  constructor(
    conn: Connection,
    prefix: string = "KV",
    options?: Partial<KvOptions>,
  ) {
    const driver = new Kvm(conn);
    this._driver = driver;
    this.#kvPromise = driver.create(prefix, options);
  }

  async get(key: string): Promise<string | null> {
    !this.#kv && (await this.#init());
    const res = await this.#kv.get(key);
    if (!res) return null;
    const value = res.string();
    switch (value.charAt(0)) {
      case "t": {
        const { value: v, expiresAt } = JSON.parse(value.slice(1));
        if (v && (!expiresAt || expiresAt > Date.now())) {
          return v;
        }
        // intentionally not awaiting the delete
        this.#kv.delete(key);
        return null;
      }
      case "n":
        return value.slice(1);
      case "":
        return null;
      default:
        throw new Error("Invalid KV value");
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    !this.#kv && (await this.#init());
    if (ttlSeconds) {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      await this.#kv.put(key, "t" + JSON.stringify({ value, expiresAt }));
    } else {
      await this.#kv.put(key, "n" + value);
    }
  }

  async delete(key: string): Promise<void> {
    !this.#kv && (await this.#init());
    await this.#kv.delete(key);
  }

  async #init() {
    this.#kv = await this.#kvPromise;
  }
}

/**
 * Options for creating a NATS KV driver.
 */
export interface NatsDriverOptions {
  /**
   * The NATS connection to use.
   */
  conn: Connection;
  /**
   * The prefix to use for all keys.
   */
  prefix?: string;
  /**
   * The KV options to use.
   */
  options?: Partial<KvOptions>;
}

/**
 * Creates a new NATS KV driver.
 * @param options The options for creating the driver.
 * @returns A new NATS KV driver.
 */
export function createNatsDriver(
  options: NatsDriverOptions,
): KvDriver<string, Kvm> {
  return new NatsDriver(options.conn, options.prefix, options.options);
}
