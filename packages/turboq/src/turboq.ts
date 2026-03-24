import { Storage } from "./storage.ts";

export type EntryId = string & { readonly __entryId: unique symbol };

export type Entry = {
  id: EntryId;
  state: "pending" | "running" | "done" | "failed";
  retryCount: number;
  maxRetryCount: number;
  /** The last error that occurred while processing this entry
   * > **NOTE**: Guaranteed to be non null if state is "failed" AND retryCount === maxRetryCount
   */
  lastError: string | null;
  data: string;
};

type QueueData = {
  generation: number;
  /** The writeId of the last successful commit, used for dedup on CAS retry */
  lastWriteId: string;
  entries: Entry[];
};

export type TurboqOptions = {
  interval?: number;
  maxRetryCount?: number;
};

export class Turboq {
  interval: number;
  storage: Storage;
  maxRetryCount: number;

  #pendingPushes: { entry: Entry; resolver: PromiseWithResolvers<EntryId> }[] =
    [];
  #consumers: PromiseWithResolvers<Entry>[] = [];
  #acks: PromiseWithResolvers<void>[] = [];
  #ackIds: Set<EntryId> = new Set();
  #nacks: { error: string; resolver: PromiseWithResolvers<void> }[] = [];
  #nackIds: Set<EntryId> = new Set();

  #lastCommit: number = Date.now();
  #waitingForCommit: PromiseWithResolvers<void>[] = [];
  #timeout: ReturnType<typeof setTimeout> | null = null;
  #runningCommitPromise: Promise<void> | null = null;
  #toConsume: Entry[] = [];

  constructor(storage: Storage, options: TurboqOptions = {}) {
    this.storage = storage;
    this.interval = options.interval ?? 200;
    this.maxRetryCount = options.maxRetryCount ?? 3;
  }

  async push(data: string, maxRetryCount?: number): Promise<EntryId> {
    if (this.#runningCommitPromise) await this.#runningCommitPromise;

    const resolver = Promise.withResolvers<EntryId>();
    const id = crypto.randomUUID() as EntryId;
    this.#pendingPushes.push({
      entry: {
        id,
        state: "pending",
        data,
        retryCount: 0,
        maxRetryCount: maxRetryCount ?? this.maxRetryCount,
        lastError: null,
      },
      resolver,
    });
    this.commit();
    return resolver.promise;
  }

  async pop(): Promise<Entry> {
    if (this.#runningCommitPromise) await this.#runningCommitPromise;

    const p = Promise.withResolvers<Entry>();
    this.#consumers.push(p);
    this.commit();
    return p.promise;
  }

  async ack(id: EntryId): Promise<void> {
    if (this.#runningCommitPromise) await this.#runningCommitPromise;

    const p = Promise.withResolvers<void>();
    this.#ackIds.add(id);
    this.#acks.push(p);
    this.commit();
    return p.promise;
  }

  async nack(id: EntryId, error: string): Promise<void> {
    if (this.#runningCommitPromise) await this.#runningCommitPromise;

    const p = Promise.withResolvers<void>();
    this.#nackIds.add(id);
    this.#nacks.push({ error, resolver: p });
    this.commit();
    return p.promise;
  }

  async commit(force: boolean = false) {
    const commitPromise = Promise.withResolvers<void>();
    const waitTime = this.#lastCommit + this.interval - Date.now();
    if (waitTime > 0 && !force) {
      this.#waitingForCommit.push(commitPromise);
      if (!this.#timeout) {
        this.#timeout = setTimeout(async () => {
          try {
            await this.#commit();
          } catch (e) {
            throw e;
          } finally {
            this.#timeout = null;
          }
        }, waitTime);
      }
      return commitPromise.promise;
    }

    if (this.#runningCommitPromise) return this.#runningCommitPromise;
    try {
      this.#runningCommitPromise = this.#commit();
      await this.#runningCommitPromise;
      for (const waitPromise of this.#waitingForCommit) {
        waitPromise.resolve();
      }
    } catch (e) {
      for (const waitPromise of this.#waitingForCommit) {
        waitPromise.reject(e);
      }
      throw e;
    } finally {
      this.#runningCommitPromise = null;
      this.#lastCommit = Date.now();
      this.#waitingForCommit.length = 0;
    }
  }

  async #commit() {
    // Generate a unique ID for this commit attempt so we can detect
    // "write succeeded but response was lost" on retry.
    const writeId = crypto.randomUUID();

    try {
      const maxRetries = 4;
      for (let tryCount = 0; tryCount < maxRetries; tryCount++) {
        const existing = await this.storage.get("queue.json");
        const queue: QueueData = existing
          ? JSON.parse(existing.data)
          : {
              generation: 0,
              lastWriteId: "",
              entries: [],
            };

        // If the queue already contains our writeId, a previous attempt
        // for this exact commit succeeded but we didn't get the response.
        // Our mutations are already applied -- just resolve and move on.
        if (queue.lastWriteId === writeId) break;

        const entries = queue.entries;
        for (const { entry } of this.#pendingPushes) {
          entries.push(entry);
        }

        let ackedCount = 0;
        let nackedCount = 0;

        for (const entry of entries) {
          if (entry.state === "running") {
            if (this.#ackIds.has(entry.id)) {
              entry.state = "done";
              ackedCount++;
              continue;
            } else if (this.#nackIds.has(entry.id)) {
              entry.lastError = this.#nacks[nackedCount].error;
              nackedCount++;
              entry.state = "failed";
              if (entry.retryCount < entry.maxRetryCount) {
                entry.retryCount++;
                entry.state = "pending";
                // fall through to pending
              } else continue;
            }
          }

          const totalConsumers = this.#consumers.length;
          if (entry.state === "pending") {
            const hasWaitingConsumers = totalConsumers > this.#toConsume.length;
            if (hasWaitingConsumers) {
              entry.state = "running";
              this.#toConsume.push(entry);
            }
          }

          if (
            this.#ackIds.size === ackedCount &&
            totalConsumers === this.#toConsume.length &&
            this.#nackIds.size === nackedCount
          ) {
            break;
          }
        }

        const result: QueueData = {
          generation: queue.generation + 1,
          lastWriteId: writeId,
          entries: entries.filter((entry) => entry.state !== "done"),
        };
        const success = await this.storage.putCAS(
          "queue.json",
          JSON.stringify(result),
          existing?.etag,
        );
        if (!success) {
          this.#toConsume.length = 0;

          if (tryCount === maxRetries - 1) {
            throw new Error(
              "Failed to commit after " + maxRetries + " retries",
            );
          }

          continue; // retry the commit
        }

        break;
      }

      // Resolve all pending promises on success
      for (const { entry, resolver } of this.#pendingPushes) {
        resolver.resolve(entry.id);
      }

      for (let cId = 0; cId < this.#toConsume.length; cId++) {
        const consumer = this.#consumers[cId];
        const entry = this.#toConsume[cId];
        consumer.resolve(entry);
      }

      for (let aId = 0; aId < this.#acks.length; aId++) {
        const ack = this.#acks[aId];
        ack.resolve();
      }

      for (let nId = 0; nId < this.#nacks.length; nId++) {
        const nack = this.#nacks[nId];
        nack.resolver.resolve();
      }
    } catch (e) {
      for (const { resolver } of this.#pendingPushes) {
        resolver.reject(e);
      }

      for (let cId = 0; cId < this.#toConsume.length; cId++) {
        const consumer = this.#consumers[cId];
        consumer.reject(e);
      }

      for (let aId = 0; aId < this.#acks.length; aId++) {
        const ack = this.#acks[aId];
        ack.reject(e);
      }

      for (let nId = 0; nId < this.#nacks.length; nId++) {
        const nack = this.#nacks[nId];
        nack.resolver.reject(e);
      }

      throw e;
    } finally {
      this.#pendingPushes.length = 0;
      this.#consumers.splice(0, this.#toConsume.length);
      this.#toConsume.length = 0;
      this.#ackIds.clear();
      this.#acks.length = 0;
      this.#nackIds.clear();
      this.#nacks.length = 0;
    }
  }
}
