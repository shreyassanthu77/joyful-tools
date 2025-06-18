import type { KvDriver } from "@joyful/kv";
import { Kvm, type KV, type KvOptions } from "@nats-io/kv-deno";
import { NatsDriver } from "./base.ts";

type Connection = ConstructorParameters<typeof Kvm>[0];

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
export async function createNatsDriver(
  options: NatsDriverOptions,
): Promise<KvDriver<string, KV>> {
  const kvm = new Kvm(options.conn);
  const kv = await kvm.create(options.prefix ?? "KV", options.options);
  return new NatsDriver(kv) as KvDriver<string, KV>;
}
