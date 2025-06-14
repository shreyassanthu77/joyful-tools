import type { KvDriver } from "./kv.ts";

class MemoryDriver implements KvDriver<string, never> {
  _driver: never = undefined as never;
  #data: Map<string, { value: string; expiresAt: number | null }> = new Map();

  get(key: string): string | Promise<string | null> | null {
    const value = this.#data.get(key);
    if (value && (!value.expiresAt || value.expiresAt > Date.now())) {
      return value.value;
    }
    if (value?.value) {
      // expired
      this.#data.delete(key);
    }
    return null;
  }
  set(key: string, value: string, ttlSeconds?: number): void | Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.#data.set(key, { value, expiresAt });
  }
  delete(key: string): void | Promise<void> {
    this.#data.delete(key);
  }
  clear(prefix: string): void | Promise<void> {
    for (const key of this.#data.keys()) {
      if (key.startsWith(prefix)) {
        this.#data.delete(key);
      }
    }
  }
}

export function createMemoryDriver(): MemoryDriver {
  return new MemoryDriver();
}
