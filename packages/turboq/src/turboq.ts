import type { Storage, EntryId } from "./types.ts";
import { TypedEventTarget } from "./types.ts";

export type TurboqOptions = {
  maxRetryCount?: number;
  /** Default heartbeat timeout in milliseconds. Per-entry override via push(). Default: 30_000 (30s) */
  heartbeatTimeout?: number;
};

export type Entry = {
  id: EntryId;
  state: "pending" | "running" | "done" | "dead";
  retryCount: number;
  maxRetryCount: number;
  /** Heartbeat timeout in milliseconds for this entry */
  heartbeatTimeout: number;
  /** Timestamp (ms since epoch) of last heartbeat, set when claimed and updated by heartbeat() */
  lastHeartbeat: number | null;
  /** Timestamp (ms since epoch) when entry becomes available for claiming. null = immediately available */
  availableAt: number | null;
  lastError: string | null;
  data: string;
};

export class Turboq extends TypedEventTarget<TurboqEvents> {
  maxRetryCount: number;
  heartbeatTimeout: number;
  storage: Storage;

  constructor(storage: Storage, options: TurboqOptions = {}) {
    super();
    this.storage = storage;
    this.maxRetryCount = options.maxRetryCount ?? 5;
    this.heartbeatTimeout = options.heartbeatTimeout ?? 30_000;
  }

  #pushes: PushOp[] = [];
  push(
    data: string,
    options?: {
      maxRetryCount?: number;
      heartbeatTimeout?: number;
      availableAt?: number;
    },
  ): Promise<EntryId> {
    const resolvers = Promise.withResolvers<EntryId>();
    this.#pushes.push({
      data,
      maxRetryCount: options?.maxRetryCount ?? this.maxRetryCount,
      heartbeatTimeout: options?.heartbeatTimeout ?? this.heartbeatTimeout,
      availableAt: options?.availableAt ?? null,
      resolvers,
    });
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

  #heartbeats: Map<EntryId, HeartbeatOp> = new Map();
  heartbeat(entryId: EntryId): Promise<void> {
    const resolvers = Promise.withResolvers<void>();
    this.#heartbeats.set(entryId, resolvers);
    this.#scheduleCommit();
    return resolvers.promise;
  }

  #wakeTimer: ReturnType<typeof setTimeout> | null = null;

  async #commit() {
    const pushes = this.#pushes;
    this.#pushes = [];
    const pops = this.#pops;
    this.#pops = [];
    const acks = this.#acks;
    this.#acks = new Map();
    const nacks = this.#nacks;
    this.#nacks = new Map();
    const heartbeats = this.#heartbeats;
    this.#heartbeats = new Map();

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
          heartbeatTimeout: op.heartbeatTimeout,
          lastHeartbeat: null,
          availableAt: op.availableAt,
          data: op.data,
          lastError: null,
        };
        queue.entries.push(entry);
        pushedIds.push(entry.id);
      }

      const poppedEntries: Entry[] = [];
      const doneEntries: Entry[] = [];
      const deadEntries: Entry[] = [];
      const timedOutEntries: Entry[] = [];
      const ackAndNackResolvers: PromiseWithResolvers<void>[] = [];
      const now = Date.now();
      let earliestWake: number | null = null;

      for (const entry of queue.entries) {
        switch (entry.state) {
          case "pending": {
            const isAvailable =
              entry.availableAt === null || entry.availableAt <= now;
            if (isAvailable && poppedEntries.length < pops.length) {
              entry.state = "running";
              entry.lastHeartbeat = now;
              poppedEntries.push(entry);
            } else if (!isAvailable) {
              // Deferred entry — track when it becomes available
              if (earliestWake === null || entry.availableAt! < earliestWake) {
                earliestWake = entry.availableAt!;
              }
            }
            break;
          }
          case "running": {
            const ack = acks.get(entry.id);
            const nack = nacks.get(entry.id);
            const hb = heartbeats.get(entry.id);
            if (nack && ack) {
              ack.reject(new Error("cannot ack/nack entry twice"));
              nack.resolvers.reject(new Error("cannot ack/nack entry twice"));
              acks.delete(entry.id);
              nacks.delete(entry.id);
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
                entry.lastHeartbeat = null;
              }
              ackAndNackResolvers.push(nack.resolvers);
            } else if (hb) {
              // Worker sent a heartbeat — update timestamp
              entry.lastHeartbeat = now;
              ackAndNackResolvers.push(hb);
            } else {
              // No explicit operation on this running entry — check for timeout
              const lastHb = entry.lastHeartbeat ?? 0;
              const expiresAt = lastHb + entry.heartbeatTimeout;
              if (now >= expiresAt) {
                // Heartbeat expired — re-queue as pending
                entry.state = "pending";
                entry.retryCount++;
                entry.lastHeartbeat = null;
                timedOutEntries.push(entry);
              } else {
                // Still running — track when it will expire
                if (earliestWake === null || expiresAt < earliestWake) {
                  earliestWake = expiresAt;
                }
              }
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
      queue.lastId = nextId - 1;
      const result = await this.storage.putCAS(
        "queue.json",
        JSON.stringify(queue),
        queueJSON?.etag,
      );
      if (!result) {
        // CAS failed — merge any new ops that arrived during this attempt
        pushes.push(...this.#pushes);
        pops.push(...this.#pops);
        for (const [id, op] of this.#acks) acks.set(id, op);
        for (const [id, op] of this.#nacks) nacks.set(id, op);
        for (const [id, op] of this.#heartbeats) heartbeats.set(id, op);

        // Clear globals for next iteration
        this.#pushes = [];
        this.#pops = [];
        this.#acks = new Map();
        this.#nacks = new Map();
        this.#heartbeats = new Map();
        continue casRetry;
      }

      for (let i = 0; i < pushes.length; i++) {
        pushes[i].resolvers.resolve(pushedIds[i]);
      }

      for (let i = 0; i < poppedEntries.length; i++) {
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
      if (timedOutEntries.length > 0) {
        this.dispatchEvent(new TurboqTimeoutEvent(timedOutEntries));
      }

      // Schedule wake for earliest timeout
      if (this.#wakeTimer) {
        clearTimeout(this.#wakeTimer);
        this.#wakeTimer = null;
      }
      if (earliestWake !== null) {
        const delay = Math.max(0, earliestWake - Date.now());
        this.#wakeTimer = setTimeout(() => {
          this.#scheduleCommit();
        }, delay);
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
    for (const op of heartbeats.values()) {
      op.reject(new TurboqWriteError("CAS failed"));
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
      this.#nacks.size > 0 ||
      this.#heartbeats.size > 0
    );
  }
}

type PushOp = {
  data: string;
  maxRetryCount: number;
  heartbeatTimeout: number;
  availableAt: number | null;
  resolvers: PromiseWithResolvers<EntryId>;
};
type PopOp = PromiseWithResolvers<Entry>;
type AckOp = PromiseWithResolvers<void>;
type NackOp = {
  error: string;
  markDead: boolean;
  resolvers: PromiseWithResolvers<void>;
};
type HeartbeatOp = PromiseWithResolvers<void>;

type QueueData = {
  entries: Entry[];
  lastId: number;
};

export type TurboqEvents = {
  dead: TurboqDeadEvent;
  done: TurboqDoneEvent;
  timeout: TurboqTimeoutEvent;
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

export class TurboqTimeoutEvent extends CustomEvent<Entry[]> {
  constructor(entries: Entry[]) {
    super("timeout", { detail: entries });
  }
}

export class TurboqWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TurboqWriteError";
  }
}
