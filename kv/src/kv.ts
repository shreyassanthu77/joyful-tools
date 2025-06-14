/**
 * @module @joyful/kv
 * A simple, type-safe key-value store abstraction for Node and Deno with multiple driver support.
 * This module provides a simple interface for interacting with a key-value store.
 */

type PromiseOr<T> = T | Promise<T>;

/**
 * A key-value store driver.
 * This is the interface that must be implemented by a key-value store driver.
 *
 * @template Value The type of the value to be stored. Defaults to `string`.
 * @template Driver The type of the internal driver that is being used. Defaults to `unknown`.
 */
export interface KvDriver<Value = string, Driver = unknown> {
  /** Get the value associated with the given key. */
  get(key: string): PromiseOr<Value | null>;
  /**
   * Set the value associated with the given key.
   *
   * @param key The key to set the value for.
   * @param value The value to set.
   * @param ttlSeconds The time-to-live in seconds for the value. If not provided, the value will not expire.
   */
  set(key: string, value: Value, ttlSeconds?: number): PromiseOr<void>;
  /** Delete the value associated with the given key. */
  delete(key: string): PromiseOr<void>;
  /** Clear all values with the given prefix. */
  clear(prefix: string): PromiseOr<void>;
  /** The internal driver adapter (if any). */
  _driver: Driver;
}

/**
 * The result of a KV operation.
 *
 * @template T The type of the value returned by the operation.
 * @template E The type of the error returned by the operation.
 */
export type KvResult<T, E = unknown> =
  | {
      /** Whether the operation was successful. */
      ok: true;
      /** The value returned by the operation. */
      value: T;
    }
  | {
      /** Whether the operation was successful. */
      ok: false;
      /** The error returned by the operation. */
      error: E;
    };

/**
 * A key-value store.
 * This class provides a simple interface for interacting with a key-value store.
 *
 * @template Driver The type of the internal driver that is being used.
 * @template Value The type of the value to be stored. Defaults to `string`.
 */
class Kv<Driver = unknown, Value = string> {
  /**
   * The internal driver adapter.
   */
  inner: KvDriver<Value, Driver>;
  #prefix: string;

  constructor(kvDriver: KvDriver<Value, Driver>, prefix: string = "kv") {
    this.inner = kvDriver;
    this.#prefix = prefix;
  }

  /**
   * Creates a new Kv instance with a different namespace.
   * This is useful for separating different parts of your application into different namespaces.
   * eg: An auth namespace to store session info and a cache namespace to store cached data.
   *
   * @param namespace The namespace to use.
   * @returns A new Kv instance with the specified namespace.
   */
  fork(namespace: string): Kv<Driver, Value> {
    return new Kv(this.inner, `${this.#prefix}:${namespace}`);
  }

  /**
   * Gets the value associated with the given key.
   *
   * @param key The key to get the value for.
   * @returns A promise that resolves to `KvResult` containing the value or an error.
   */
  async get(key: string): Promise<KvResult<Value | null>> {
    key = `${this.#prefix}:${key}`;
    try {
      const value = await this.inner.get(key);
      return { ok: true, value };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  /**
   * Sets the value associated with the given key.
   *
   * @param key The key to set the value for.
   * @param value The value to set.
   * @param ttlSeconds The time-to-live in seconds for the value. If not provided, the value will not expire.
   */
  async set(
    key: string,
    value: Value,
    ttlSeconds?: number,
  ): Promise<KvResult<void>> {
    key = `${this.#prefix}:${key}`;
    try {
      await this.inner.set(key, value, ttlSeconds);
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  /**
   * Deletes the value associated with the given key.
   *
   * @param key The key to delete the value for.
   */
  async delete(key: string): Promise<KvResult<void>> {
    key = `${this.#prefix}:${key}`;
    try {
      await this.inner.delete(key);
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  /**
   * Clears all values set in the current namespace.
   */
  async clear(): Promise<KvResult<void>> {
    try {
      await this.inner.clear(this.#prefix);
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: e };
    }
  }
}

export type { Kv };

/**
 * Options for creating a Kv instance.
 *
 * @template Driver The type of the internal driver that is being used.
 * @template Value The type of the value to be stored. Defaults to `string`.
 */
export interface KvOptions<Driver = unknown, Value = string> {
  /**
   * The driver to use for interacting with the key-value store.
   */
  driver: KvDriver<Value, Driver>;
  /**
   * The prefix to use for the key-value store.
   */
  prefix?: string;
}

/**
 * Creates a new Kv instance.
 *
 * @template Driver The type of the internal driver that is being used.
 * @template Value The type of the value to be stored. Defaults to `string`.
 * @param options The options for creating the Kv instance.
 * @returns A new Kv instance.
 */
export function createKv<Driver = unknown, Value = string>(
  options: KvOptions<Driver, Value>,
): Kv<Driver, Value> {
  return new Kv(options.driver, options.prefix);
}
