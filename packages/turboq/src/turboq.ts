import type { Storage, EntryId } from "./types.ts";
import { TypedEventTarget } from "./types.ts";

export type TurboqOptions = {
  maxRetryCount?: number;
};

export type Entry = {
  id: EntryId;
  state: "pending" | "running" | "done" | "failed" | "dead";
  retryCount: number;
  maxRetryCount: number;
  /** The last error that occurred while processing this entry
   * guaranteed to be non null if state is "dead"
   */
  lastError: string | null;
  data: string;
};

export class Turboq extends TypedEventTarget<TurboqEvents> {
  maxRetryCount: number;

  constructor(storage: Storage, options: TurboqOptions = {}) {
    super();
    this.#storage = storage;
    this.maxRetryCount = options.maxRetryCount ?? 5;
  }

  push(
    data: string,
    maxRetryCount: number = this.maxRetryCount,
  ): Promise<EntryId> {
    const resolvers = Promise.withResolvers<EntryId>();
    this.#pushes.push({ data, maxRetryCount, resolvers });
    this.#scheduleCommit();
    return resolvers.promise;
  }

  pop(): Promise<Entry> {
    const resolvers = Promise.withResolvers<Entry>();
    this.#pops.push(resolvers);
    this.#scheduleCommit();
    return resolvers.promise;
  }

  ack(entryId: EntryId): Promise<void> {
    const resolvers = Promise.withResolvers<void>();
    this.#acks.set(entryId, resolvers);
    console.log("ack", entryId);
    this.#scheduleCommit();
    return resolvers.promise;
  }

  nack(
    entryId: EntryId,
    error: string,
    markDead: boolean = false,
  ): Promise<void> {
    const resolvers = Promise.withResolvers<void>();
    this.#nacks.set(entryId, { error, markDead, resolvers });
    console.log("nack", entryId);
    this.#scheduleCommit();
    return resolvers.promise;
  }

  #storage: Storage;
  #queue: {
    data: QueueData;
    etag?: string;
  } | null = null;
  #pushes: Array<{
    data: string;
    maxRetryCount: number;
    resolvers: PromiseWithResolvers<EntryId>;
  }> = [];
  #pops: PromiseWithResolvers<Entry>[] = [];
  #acks: Map<EntryId, PromiseWithResolvers<void>> = new Map();
  // prettier-ignore
  #nacks: Map<EntryId, {
		error: string;
		markDead: boolean;
		resolvers: PromiseWithResolvers<void>;
	}> = new Map();
  #running: Promise<void> | null = null;
  #pendingCommit = false;
  #scheduled = false;

  #scheduleCommit() {
    // If a commit is already in flight, just mark that we need another round.
    if (this.#running) {
      this.#pendingCommit = true;
      return;
    }
    // Otherwise schedule on the microtask queue if not already scheduled.
    // Everything called synchronously in the same call stack gets batched
    // into a single commit.
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#running = this.#commitLoop();
      this.#running.then(() => {
        this.#running = null;
      });
    });
  }

  async #commitLoop() {
    // Keep running as long as there is buffered work.
    // This handles the group commit coalescing: requests that arrive during
    // an in-flight commit get picked up on the next iteration immediately,
    // without waiting for another setTimeout.
    do {
      this.#pendingCommit = false;
      await this.#commit();
      // Yield to the microtask queue so that promise continuations from
      // resolved push/pop/ack/nack promises can schedule new work before
      // we check the loop condition.
      await Promise.resolve();
    } while (this.#pendingCommit || this.#hasPendingWork());
  }

  #hasPendingWork(): boolean {
    // Pops are intentionally excluded: there's no point doing a read/CAS
    // round just to discover there's nothing to pop. Unfulfilled pops stay
    // in #pops and get resolved when the next push/ack/nack triggers a commit.
    return (
      this.#pushes.length > 0 || this.#acks.size > 0 || this.#nacks.size > 0
    );
  }

  async #commit() {
    const queue = await this.#loadQueue();
    const entries = queue.data.entries;

    const pushes = this.#pushes;
    const pops = this.#pops;
    const acks = this.#acks;
    const nacks = this.#nacks;
    this.#pushes = [];
    this.#pops = [];
    this.#acks = new Map();
    this.#nacks = new Map();

    const doneEntries: Entry[] = [];
    const deadEntries: Entry[] = [];
    const pushResults: Array<{
      entry: Entry;
      resolvers: PromiseWithResolvers<EntryId>;
    }> = [];
    const poppedEntries: Entry[] = [];
    const totalPoppers = pops.length;
    const ackResolvers: PromiseWithResolvers<void>[] = [];
    const nackResolvers: PromiseWithResolvers<void>[] = [];

    for (const push of pushes) {
      const entry: Entry = {
        id: crypto.randomUUID() as EntryId,
        state: "pending",
        retryCount: 0,
        maxRetryCount: push.maxRetryCount,
        data: push.data,
        lastError: null,
      };
      entries.push(entry);
      pushResults.push({ entry, resolvers: push.resolvers });

      if (poppedEntries.length < totalPoppers) {
        entry.state = "running";
        poppedEntries.push(entry);
      }
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      switch (entry.state) {
        case "running": {
          const ack = acks.get(entry.id);
          const nack = nacks.get(entry.id);
          if (ack && nack) {
            ack.reject(new Error("ack and nack for same entry"));
            nack.resolvers.reject(new Error("ack and nack for same entry"));
            acks.delete(entry.id);
            nacks.delete(entry.id);
          } else if (ack) {
            entry.state = "done";
            doneEntries.push(entry);
            ackResolvers.push(ack);
            acks.delete(entry.id);
          } else if (nack) {
            entry.lastError = nack.error;
            entry.retryCount++;
            nackResolvers.push(nack.resolvers);
            nacks.delete(entry.id);
            if (nack.markDead || entry.retryCount >= entry.maxRetryCount) {
              entry.state = "dead";
              deadEntries.push(entry);
              if (nack.markDead) entry.retryCount -= 1;
            } else if (poppedEntries.length < totalPoppers) {
              poppedEntries.push(entry);
            } else {
              entry.state = "pending";
            }
          }
          break;
        }
        case "failed": {
          if (entry.retryCount < entry.maxRetryCount) {
            if (poppedEntries.length < totalPoppers) {
              entry.state = "running";
              poppedEntries.push(entry);
            } else {
              entry.state = "pending";
            }
          } else {
            entry.state = "dead";
            deadEntries.push(entry);
          }
          break;
        }
        case "pending":
        case "done":
        case "dead":
          break;
      }
    }

    if (poppedEntries.length < totalPoppers) {
      for (let i = 0; i < entries.length; i++) {
        if (poppedEntries.length >= totalPoppers) break;
        const entry = entries[i];
        if (entry.state === "pending") {
          entry.state = "running";
          poppedEntries.push(entry);
        }
      }
    }

    queue.data.entries = entries.filter(
      (e) => e.state !== "dead" && e.state !== "done",
    );

    // prettier-ignore
    const writeResult = await this.#storage.putCAS("queue.json", JSON.stringify(queue.data), queue.etag);
    if (!writeResult) {
      throw new Error("CAS failed, another broker/writer is online. TODO");
    }
    queue.data.generation++;
    queue.etag = writeResult;

    if (doneEntries.length > 0) {
      this.dispatchEvent(new TurboqDoneEvent(doneEntries));
    }
    if (deadEntries.length > 0) {
      this.dispatchEvent(new TurboqDeadEvent(deadEntries));
    }

    for (const { entry, resolvers } of pushResults) {
      resolvers.resolve(entry.id);
    }

    for (let i = 0; i < poppedEntries.length; i++) {
      pops[i].resolve(poppedEntries[i]);
    }
    for (let i = poppedEntries.length; i < totalPoppers; i++) {
      this.#pops.push(pops[i]);
    }

    for (const ack of ackResolvers) ack.resolve();
    for (const nack of nackResolvers) nack.resolve();
  }

  async #loadQueue(force = false) {
    if (!force && this.#queue) return this.#queue;

    const serialized = await this.#storage.get("queue");
    if (serialized) {
      this.#queue = {
        data: JSON.parse(serialized.data) as QueueData,
        etag: serialized.etag,
      };
    } else {
      this.#queue = {
        data: {
          generation: 0,
          lastWriteId: "",
          entries: [],
        },
      };
    }
    return this.#queue;
  }
}

export type TurboqEvents = {
  dead: TurboqDeadEvent;
  done: TurboqDoneEvent;
};

export class TurboqDeadEvent extends CustomEvent<Entry[]> {
  constructor(entries: Entry[]) {
    super("dead", {
      detail: entries,
    });
  }
}

export class TurboqDoneEvent extends CustomEvent<Entry[]> {
  constructor(entries: Entry[]) {
    super("done", {
      detail: entries,
    });
  }
}

type QueueData = {
  generation: number;
  /** The writeId of the last successful commit, used for dedup on CAS retry */
  lastWriteId: string;
  entries: Entry[];
};
