import type { KvDriver } from "./kv.ts";

class DenoDriver implements KvDriver<string, Deno.Kv> {
  _driver: Deno.Kv;
  #prefix: string;

  constructor(kv: Deno.Kv, prefix: string = "KV") {
    this._driver = kv;
    this.#prefix = prefix;
  }
  async get(key: string): Promise<string | null> {
    const res = await this._driver.get<string>([this.#prefix, key]);
    return res.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this._driver.set([this.#prefix, key], value, {
      expireIn: ttlSeconds ? ttlSeconds * 1000 : undefined,
    });
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

export interface DenoDriverOptions {
  kv: Deno.Kv;
  prefix?: string;
}

export function createDenoDriver(options: DenoDriverOptions): KvDriver<string> {
  return new DenoDriver(options.kv, options.prefix);
}
