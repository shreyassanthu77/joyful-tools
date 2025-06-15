import type { KvDriver } from "./kv.ts";

class DenoDriver implements KvDriver<string, Deno.Kv> {
  _driver: Deno.Kv;
  #prefix: string;

  constructor(kv: Deno.Kv, prefix: string = "KV") {
    this._driver = kv;
    this.#prefix = prefix;
  }
  async get(key: string): Promise<string | null> {
    const res = await this._driver.get<{
      value: string;
      expiresAt: number | null;
    }>([this.#prefix, key]);
    if (!res.value) return null;
    const { value, expiresAt } = res.value;
    if (value && (!expiresAt || expiresAt > Date.now())) {
      return value;
    }
    // deletion will be taken care of by deno kv
    return null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    await this._driver.set(
      [this.#prefix, key],
      { value, expiresAt },
      {
        expireIn: ttlSeconds ? ttlSeconds * 1000 : undefined,
      },
    );
  }

  async delete(key: string): Promise<void> {
    await this._driver.delete([this.#prefix, key]);
  }

  async clear(prefix: string): Promise<void> {
    const tx = this._driver.atomic();
    for await (const entry of this._driver.list({
      prefix: [this.#prefix],
      start: [prefix],
    })) {
      tx.delete(entry.key);
    }
    const res = await tx.commit();
    if (!res.ok) {
      throw "Failed to clear Deno KV";
    }
  }
}

/**
 * Options for creating a Deno KV driver.
 */
export interface DenoDriverOptions {
  /** The Deno KV instance to use. */
  kv: Deno.Kv;
  /** The prefix to use for all keys. */
  prefix?: string;
}

/**
 * Creates a new Deno KV driver.
 * @param options The options for creating the driver.
 * @returns A new Deno KV driver.
 */
export function createDenoDriver(
  options: DenoDriverOptions,
): KvDriver<string, Deno.Kv> {
  return new DenoDriver(options.kv, options.prefix);
}
