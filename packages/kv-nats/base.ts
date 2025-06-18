import type { KvDriver } from "@joyful/kv";

export class NatsDriver implements KvDriver<string, KV> {
  _driver: KV;

  constructor(driver: KV) {
    this._driver = driver;
  }

  async get(key: string): Promise<string | null> {
    const res = await this._driver.get(key);
    if (!res) return null;
    const value = res.string();
    switch (value.charAt(0)) {
      case "t": {
        const { value: v, expiresAt } = JSON.parse(value.slice(1));
        if (v && (!expiresAt || expiresAt > Date.now())) {
          return v;
        }
        // intentionally not awaiting the delete
        this._driver.delete(key);
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
    if (ttlSeconds) {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      await this._driver.put(key, "t" + JSON.stringify({ value, expiresAt }));
    } else {
      await this._driver.put(key, "n" + value);
    }
  }

  async delete(key: string): Promise<void> {
    await this._driver.delete(key);
  }
}
type Payload = Uint8Array | string;

type KvEntry = {
  bucket: string;
  key: string;
  value: Uint8Array;
  created: Date;
  revision: number;
  delta?: number;
  operation: "PUT" | "DEL" | "PURGE";
  length: number;
  json<T>(): T;
  string(): string;
};

interface KV {
  get(k: string): Promise<KvEntry | null>;
  create(k: string, data: Payload): Promise<number>;
  put(k: string, data: Payload): Promise<number>;
  delete(k: string): Promise<void>;
  purge(k: string): Promise<void>;
  destroy(): Promise<boolean>;
}
