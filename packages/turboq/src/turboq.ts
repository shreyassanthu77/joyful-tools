import type { Storage, EntryId } from "./types.ts";
import { TypedEventTarget } from "./types.ts";

export type TurboqOptions = {
  maxRetryCount?: number;
};

export type Entry = {
  id: EntryId;
  state: "pending" | "running" | "done" | "dead";
  retryCount: number;
  maxRetryCount: number;
  lastError: string | null;
  data: string;
};

export class Turboq extends TypedEventTarget<TurboqEvents> {
  maxRetryCount: number;
  storage: Storage;

  constructor(storage: Storage, options: TurboqOptions = {}) {
    super();
    this.storage = storage;
    this.maxRetryCount = options.maxRetryCount ?? 5;
  }

  #pushes: PushOp[] = [];
  push(
    data: string,
    maxRetryCount: number = this.maxRetryCount,
  ): Promise<EntryId> {
    const resolvers = Promise.withResolvers<EntryId>();
    this.#pushes.push({ data, maxRetryCount, resolvers });
    this.#scheduleCommit();
    return resolvers.promise;
  }

  #pops: PopOp[] = [];
  pop(): Promise<Entry> {
    const resolvers = Promise.withResolvers<Entry>();
    this.#pops.push(resolvers);
    this.#scheduleCommit();
    return resolvers.promise;
  }

  #acks: Map<EntryId, AckOp> = new Map();
  ack(entryId: EntryId): Promise<void> {
    const resolvers = Promise.withResolvers<void>();
    this.#acks.set(entryId, resolvers);
    this.#scheduleCommit();
    return resolvers.promise;
  }

  #nacks: Map<EntryId, NackOp> = new Map();
  nack(
    entryId: EntryId,
    error: string,
    markDead: boolean = false,
  ): Promise<void> {
    const resolvers = Promise.withResolvers<void>();
    this.#nacks.set(entryId, { error, markDead, resolvers });
    this.#scheduleCommit();
    return resolvers.promise;
  }

  async #commit() {
    const pushes = this.#pushes;
    this.#pushes = [];
    const pops = this.#pops;
    this.#pops = [];
    const acks = this.#acks;
    this.#acks = new Map();
    const nacks = this.#nacks;
    this.#nacks = new Map();

    const maxCasRetries = 10;
    casRetry: for (let i = 0; i < maxCasRetries; i++) {
      const queueJSON = await this.storage.get("queue.json");
      const queue: QueueData = queueJSON
        ? JSON.parse(queueJSON.data)
        : { entries: [], lastId: 0 };

      let nextId = queue.lastId + 1;

      const pushedIds: EntryId[] = [];
      for (const op of pushes) {
        const entry: Entry = {
          id: nextId++ as EntryId,
          state: "pending",
          retryCount: 0,
          maxRetryCount: op.maxRetryCount,
          data: op.data,
          lastError: null,
        };
        queue.entries.push(entry);
        pushedIds.push(entry.id);
      }

      const poppedEntries: Entry[] = [];
      const doneEntries: Entry[] = [];
      const deadEntries: Entry[] = [];
      const ackAndNackResolvers: PromiseWithResolvers<void>[] = [];

      for (const entry of queue.entries) {
        switch (entry.state) {
          case "pending": {
            if (poppedEntries.length < pops.length) {
              entry.state = "running";
              poppedEntries.push(entry);
            }
            break;
          }
          case "running": {
            const ack = acks.get(entry.id);
            const nack = nacks.get(entry.id);
            if (nack && ack) {
              ack.reject(new Error("cannot ack/nack entry twice"));
              nack.resolvers.reject(new Error("cannot ack/nack entry twice"));
              this.#acks.delete(entry.id);
              this.#nacks.delete(entry.id);
            } else if (ack) {
              entry.state = "done";
              doneEntries.push(entry);
              ackAndNackResolvers.push(ack);
            } else if (nack) {
              const canRetry = entry.retryCount < entry.maxRetryCount;
              if (nack.markDead || !canRetry) {
                entry.state = "dead";
                deadEntries.push(entry);
              } else {
                entry.state = "pending";
                entry.retryCount++;
              }
              ackAndNackResolvers.push(nack.resolvers);
            } else {
              // todo: handle heartbeats
            }
            break;
          }
          case "done": {
            doneEntries.push(entry);
            break;
          }
          case "dead": {
            deadEntries.push(entry);
            break;
          }
        }
      }

      queue.entries = queue.entries.filter(
        (entry) => entry.state !== "dead" && entry.state !== "done",
      );
      queue.lastId = nextId;
      const result = await this.storage.putCAS(
        "queue.json",
        JSON.stringify(queue),
        queueJSON?.etag,
      );
      if (!result) continue casRetry;

      for (let i = 0; i < pushes.length; i++) {
        pushes[i].resolvers.resolve(pushedIds[i]);
      }

      for (let i = 0; i < pops.length; i++) {
        const pop = pops[i];
        const poppedEntry = poppedEntries[i];
        pop.resolve(poppedEntry);
      }
      if (pops.length > poppedEntries.length) {
        for (let i = poppedEntries.length; i < pops.length; i++) {
          this.#pops.push(pops[i]);
        }
      }

      for (const r of ackAndNackResolvers) r.resolve();

      if (doneEntries.length > 0) {
        this.dispatchEvent(new TurboqDoneEvent(doneEntries));
      }
      if (deadEntries.length > 0) {
        this.dispatchEvent(new TurboqDeadEvent(deadEntries));
      }

      return;
    }
    // error: CAS failed, another broker/writer is online.
    for (const op of pushes) {
      op.resolvers.reject(new TurboqWriteError("CAS failed"));
    }
    for (const op of pops) {
      op.reject(new TurboqWriteError("CAS failed"));
    }
    for (const op of acks.values()) {
      op.reject(new TurboqWriteError("CAS failed"));
    }
    for (const op of nacks.values()) {
      op.resolvers.reject(new TurboqWriteError("CAS failed"));
    }
  }

  #commitPending = false;
  #running: Promise<void> | null = null;
  #scheduled = false;

  #scheduleCommit() {
    if (this.#running) {
      this.#commitPending = true;
      return;
    }
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
    do {
      this.#commitPending = false;
      await this.#commit();
      await Promise.resolve();
    } while (
      this.#commitPending ||
      this.#pushes.length > 0 ||
      this.#acks.size > 0 ||
      this.#nacks.size > 0
    );
  }
}

type PushOp = {
  data: string;
  maxRetryCount: number;
  resolvers: PromiseWithResolvers<EntryId>;
};
type PopOp = PromiseWithResolvers<Entry>;
type AckOp = PromiseWithResolvers<void>;
type NackOp = {
  error: string;
  markDead: boolean;
  resolvers: PromiseWithResolvers<void>;
};

type QueueData = {
  entries: Entry[];
  lastId: number;
};

export type TurboqEvents = {
  dead: TurboqDeadEvent;
  done: TurboqDoneEvent;
};

export class TurboqDeadEvent extends CustomEvent<Entry[]> {
  constructor(entries: Entry[]) {
    super("dead", { detail: entries });
  }
}

export class TurboqDoneEvent extends CustomEvent<Entry[]> {
  constructor(entries: Entry[]) {
    super("done", { detail: entries });
  }
}

export class TurboqWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TurboqWriteError";
  }
}
