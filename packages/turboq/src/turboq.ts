import { Storage } from "./storage.ts";

export type EntryId = string & { readonly __entryId: unique symbol };

export type Entry = {
  id: EntryId;
  state: "pending" | "running" | "done";
  data: string;
};

export class Turboq {
  interval = 2000;
  storage: Storage;

  #producers: PromiseWithResolvers<EntryId>[] = [];
  #writes: Entry[] = [];
  #consumers: PromiseWithResolvers<Entry>[] = [];
  #acks: Set<EntryId> = new Set();

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

    const p = Promise.withResolvers<EntryId>();
    this.#producers.push(p);
    const id = crypto.randomUUID() as EntryId;
    this.#writes.push({ id, state: "pending", data });
    this.commit();
    return p.promise;
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
    this.#acks.add(id);
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
    try {
      const maxRetries = 4;
      for (let tryCount = 0; tryCount < maxRetries; tryCount++) {
        const existing = await this.storage.get("queue.json");

        const parsed: Entry[] = existing ? JSON.parse(existing.data) : [];
        parsed.push(...this.#writes);
        for (const entry of parsed) {
          if (entry.state === "running") {
            if (this.#acks.has(entry.id)) {
              entry.state = "done";
              continue;
            }
          } else if (entry.state === "pending") {
            if (this.#consumers.length > this.#toConsume.length) {
              entry.state = "running";
              this.#toConsume.push(entry);
            }
          }

          if (
            this.#acks.size === 0 &&
            this.#toConsume.length === this.#consumers.length
          ) {
            break;
          }
        }
        const result = parsed.filter((entry) => entry.state !== "done");
        const success = await this.storage.putCAS(
          "queue.json",
          JSON.stringify(result),
          existing?.etag,
        );
        if (!success) {
          this.#toConsume.length = 0;

          if (tryCount === 3) {
            throw new Error("Failed to commit");
          }

          continue; // retry the commit
        }

        for (let pId = 0; pId < this.#producers.length; pId++) {
          const producer = this.#producers[pId];
          const entryId = this.#writes[pId].id;
          producer.resolve(entryId);
        }

        for (let cId = 0; cId < this.#toConsume.length; cId++) {
          const consumer = this.#consumers[cId];
          const entry = this.#toConsume[cId];
          consumer.resolve(entry);
        }

        break;
      }
    } catch (e) {
      for (let pId = 0; pId < this.#producers.length; pId++) {
        const producer = this.#producers[pId];
        producer.reject(e);
      }

      for (let cId = 0; cId < this.#consumers.length; cId++) {
        const consumer = this.#consumers[cId];
        consumer.reject(e);
      }

      throw e;
    } finally {
      this.#writes.length = 0;
      this.#toConsume.length = 0;
      this.#acks.clear();
    }
  }
}
