import type { KvDriver } from "./kv.ts";
import {
  createDenoDriver as createDenoDriverCore,
  type DenoDriverOptions as DenoDriverOptionsCore,
} from "./deno-kv.ts";
import { openKv, type Kv } from "@deno/kv";

export { openKv };

/**
 * Options for creating a Deno KV driver.
 */
export interface DenoDriverOptions {
  /** The Deno KV instance to use. */
  kv: Kv;
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
): KvDriver<string, Kv> {
  return createDenoDriverCore(options as DenoDriverOptionsCore) as KvDriver<
    string,
    Kv
  >;
}
