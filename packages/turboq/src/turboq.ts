import { Storage } from "./storage.ts";

export type EntryId = string & { readonly __entryId: unique symbol };

export type Entry = {
  id: EntryId;
  state: "pending" | "running" | "done";
  data: string;
};

type QueueData = {
  generation: number;
  /** The writeId of the last successful commit, used for dedup on CAS retry */
  lastWriteId: string;
  entries: Entry[];
};

export class Turboq {
  interval = 2000;
  storage: Storage;

  #pendingPushes: { entry: Entry; resolver: PromiseWithResolvers<EntryId> }[] =
    [];
  #consumers: PromiseWithResolvers<Entry>[] = [];
  #acks: PromiseWithResolvers<void>[] = [];
  #ackIds: Set<EntryId> = new Set();

  #lastCommit: number = Date.now();
  #waitingForCommit: PromiseWithResolvers<void>[] = [];
  #timeout: ReturnType<typeof setTimeout> | null = null;
  #runningCommitPromise: Promise<void> | null = null;
  #toConsume: Entry[] = [];

  constructor(storage: Storage, interval: number = 2000) {
    this.storage = storage;
    this.interval = interval;
  }

  async push(data: string): Promise<EntryId> {
    if (this.#runningCommitPromise) await this.#runningCommitPromise;

    const resolver = Promise.withResolvers<EntryId>();
    const id = crypto.randomUUID() as EntryId;
    this.#pendingPushes.push({
      entry: { id, state: "pending", data },
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

  async commit(force: boolean = false) {
    const commitPromise = Promise.withResolvers<void>();
    const waitTime = this.#lastCommit + this.interval - Date.now();
    if (waitTime > 0 && !force) {
      this.#waitingForCommit.push(commitPromise);
      if (!this.#timeout) {
        this.#timeout = setTimeout(() => this.#commit(), waitTime);
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
        for (const entry of entries) {
          if (entry.state === "running") {
            if (this.#ackIds.has(entry.id)) {
              entry.state = "done";
              ackedCount++;
              continue;
            }
          } else if (entry.state === "pending") {
            if (this.#consumers.length > this.#toConsume.length) {
              entry.state = "running";
              this.#toConsume.push(entry);
            }
          }

          if (
            this.#ackIds.size === ackedCount &&
            this.#toConsume.length === this.#consumers.length
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
    } catch (e) {
      for (const { resolver } of this.#pendingPushes) {
        resolver.reject(e);
      }

      for (let cId = 0; cId < this.#consumers.length; cId++) {
        const consumer = this.#consumers[cId];
        consumer.reject(e);
      }

      for (let aId = 0; aId < this.#acks.length; aId++) {
        const ack = this.#acks[aId];
        ack.reject(e);
      }

      throw e;
    } finally {
      this.#pendingPushes.length = 0;
      this.#toConsume.length = 0;
      this.#ackIds.clear();
      this.#acks.length = 0;
    }
  }
}
