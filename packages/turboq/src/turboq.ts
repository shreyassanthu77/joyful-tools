import type { EntryId, Storage } from "./types.ts";
import { TypedEventTarget } from "./types.ts";

export type TurboqOptions = {
  maxRetryCount?: number;
  /** Default heartbeat timeout in milliseconds. Per-entry override via push(). Default: 30_000 (30s) */
  heartbeatTimeout?: number;
  /** Queue depth threshold for emitting backpressure events. Default: null (disabled) */
  backpressureThreshold?: number | null;
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
  /** Timestamp (ms since epoch) when entry expires and becomes dead. null = never expires */
  expiresAt: number | null;
  lastError: string | null;
  data: string;
};

export type DoneEntry = Entry & { state: "done" };
export type DeadEntry = Entry & { state: "dead" };
export type RunningEntry = Entry & { state: "running"; lastHeartbeat: number };
export type PendingEntry = Entry & { state: "pending"; lastHeartbeat: null };

export class Turboq extends TypedEventTarget<TurboqEvents> {
  maxRetryCount: number;
  heartbeatTimeout: number;
  backpressureThreshold: number | null;
  storage: Storage;

  #closed = false;

  constructor(storage: Storage, options: TurboqOptions = {}) {
    super();
    this.storage = storage;
    this.maxRetryCount = options.maxRetryCount ?? 5;
    this.heartbeatTimeout = options.heartbeatTimeout ?? 30_000;
    this.backpressureThreshold = options.backpressureThreshold ?? null;
  }

  #pushes: PushOp[] = [];
  push(
    data: string,
    options?: {
      maxRetryCount?: number;
      heartbeatTimeout?: number;
      availableAt?: number;
      /** Time-to-live in milliseconds. Entry expires and becomes dead after this duration. */
      ttl?: number;
    },
  ): Promise<EntryId> {
    if (this.#closed) {
      return Promise.reject(new TurboqError("Closed"));
    }
    const resolvers = Promise.withResolvers<EntryId>();
    this.#pushes.push({
      data,
      maxRetryCount: options?.maxRetryCount ?? this.maxRetryCount,
      heartbeatTimeout: options?.heartbeatTimeout ?? this.heartbeatTimeout,
      availableAt: options?.availableAt ?? null,
      expiresAt: options?.ttl != null ? Date.now() + options.ttl : null,
      resolvers,
    });
    this.#scheduleCommit();
    return resolvers.promise;
  }

  #pops: PopOp[] = [];
  pop(): Promise<Entry> {
    if (this.#closed) {
      return Promise.reject(new TurboqError("Closed"));
    }
    const resolvers = Promise.withResolvers<Entry>();
    this.#pops.push(resolvers);
    this.#scheduleCommit();
    return resolvers.promise;
  }

  #acks: Map<EntryId, AckOp> = new Map();
  #acksInFlight: Map<EntryId, AckOp> | null = null;
  ack(entryId: EntryId): Promise<void> {
    if (this.#closed) {
      return Promise.reject(new TurboqError("Closed"));
    }
    const resolvers = Promise.withResolvers<void>();

    const existingAck = this.#acks.get(entryId) ??
      this.#acksInFlight?.get(entryId);
    const existingNack = this.#nacks.get(entryId) ??
      this.#nacksInFlight?.get(entryId);
    if (existingNack) {
      resolvers.reject(new TurboqError("DoubleAck"));
    } else if (existingAck) {
      existingAck.promise.then(resolvers.resolve, resolvers.reject);
    } else {
      this.#acks.set(entryId, resolvers);
      this.#scheduleCommit();
    }
    return resolvers.promise;
  }

  #nacks: Map<EntryId, NackOp> = new Map();
  #nacksInFlight: Map<EntryId, NackOp> | null = null;
  nack(
    entryId: EntryId,
    error: string,
    markDead: boolean = false,
  ): Promise<void> {
    if (this.#closed) {
      return Promise.reject(new TurboqError("Closed"));
    }
    const resolvers = Promise.withResolvers<void>();
    const existingAck = this.#acks.get(entryId) ??
      this.#acksInFlight?.get(entryId);
    const existingNack = this.#nacks.get(entryId) ??
      this.#nacksInFlight?.get(entryId);
    if (existingAck) {
      resolvers.reject(new TurboqError("DoubleAck"));
    } else if (existingNack) {
      existingNack.error = error;
      existingNack.markDead ||= markDead;
      existingNack.resolvers.promise.then(resolvers.resolve, resolvers.reject);
    } else {
      this.#nacks.set(entryId, { error, markDead, resolvers });
      this.#scheduleCommit();
    }
    return resolvers.promise;
  }

  #heartbeats: Map<EntryId, HeartbeatOp> = new Map();
  #heartbeatsInFlight: Map<EntryId, HeartbeatOp> | null = null;
  heartbeat(entryId: EntryId): Promise<void> {
    if (this.#closed) {
      return Promise.reject(new TurboqError("Closed"));
    }
    const resolvers = Promise.withResolvers<void>();
    const existingHeartbeat = this.#heartbeats.get(entryId) ??
      this.#heartbeatsInFlight?.get(entryId);
    if (existingHeartbeat) {
      existingHeartbeat.promise.then(resolvers.resolve, resolvers.reject);
    } else {
      this.#heartbeats.set(entryId, resolvers);
      this.#scheduleCommit();
    }
    return resolvers.promise;
  }

  /**
   * Gracefully closes the queue.
   * - Flushes all pending pushes, acks, nacks, and heartbeats
   * - Rejects all pending pops (they'd wait forever anyway)
   * - Rejects any new operations after close is called
   */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;

    // Clear wake timer
    if (this.#wakeTimer) {
      clearTimeout(this.#wakeTimer);
      this.#wakeTimer = null;
    }

    // Reject all pending pops - they'd wait forever
    for (const pop of this.#pops) {
      pop.reject(new TurboqError("Closed"));
    }
    this.#pops = [];

    // Wait for in-flight commit to finish, which will flush pushes/acks/nacks/heartbeats
    if (this.#running) {
      await this.#running;
    }

    // If there are still pending pushes/acks/nacks/heartbeats, do one final commit
    if (
      this.#pushes.length > 0 ||
      this.#acks.size > 0 ||
      this.#nacks.size > 0 ||
      this.#heartbeats.size > 0
    ) {
      await this.#commit();
    }
  }

  #wakeTimer: ReturnType<typeof setTimeout> | null = null;

  async #commit() {
    const pushes = this.#pushes;
    this.#pushes = [];
    const pops = this.#pops;
    this.#pops = [];
    const acks = this.#acks;
    this.#acks = new Map();
    this.#acksInFlight = acks;
    const nacks = this.#nacks;
    this.#nacks = new Map();
    this.#nacksInFlight = nacks;
    const heartbeats = this.#heartbeats;
    this.#heartbeats = new Map();
    this.#heartbeatsInFlight = heartbeats;

    try {
      const maxCasRetries = 10;
      casRetry: for (let i = 0; i < maxCasRetries; i++) {
        const queueJSON = await this.storage.get("queue.json");
        const queue: QueueData = queueJSON
          ? JSON.parse(queueJSON.data)
          : { entries: [], lastId: 0 };

        let nextId = queue.lastId + 1;

        const pushedEntries: PendingEntry[] = [];
        for (const op of pushes) {
          const entry: PendingEntry = {
            id: nextId++ as EntryId,
            state: "pending",
            retryCount: 0,
            maxRetryCount: op.maxRetryCount,
            heartbeatTimeout: op.heartbeatTimeout,
            lastHeartbeat: null,
            availableAt: op.availableAt,
            expiresAt: op.expiresAt,
            data: op.data,
            lastError: null,
          };
          queue.entries.push(entry);
          pushedEntries.push(entry);
        }

        const poppedEntries: Entry[] = [];
        const ackedEntries: Entry[] = [];
        const nackedEntries: Entry[] = [];
        const deadEntries: Entry[] = [];
        const heartbeatedEntries: Entry[] = [];
        const timedOutEntries: Entry[] = [];
        const retryEntries: Entry[] = [];
        const becameAvailableEntries: Entry[] = [];
        const ackAndNackResolvers: PromiseWithResolvers<void>[] = [];
        const now = Date.now();
        let earliestWake: number | null = null;

        for (const entry of queue.entries) {
          // Check TTL expiry for all non-terminal states
          if (
            entry.expiresAt !== null &&
            now >= entry.expiresAt &&
            entry.state !== "done" &&
            entry.state !== "dead"
          ) {
            entry.state = "dead";
            entry.lastError = "TTL expired";
            deadEntries.push(entry);
            continue;
          }

          switch (entry.state) {
            case "pending": {
              const wasDeferred = entry.availableAt !== null;
              const isAvailable = entry.availableAt === null ||
                entry.availableAt <= now;
              if (isAvailable && poppedEntries.length < pops.length) {
                entry.state = "running";
                entry.lastHeartbeat = now;
                poppedEntries.push(entry);
                // Track if this was a deferred entry that just became available
                if (wasDeferred) {
                  becameAvailableEntries.push(entry);
                }
              } else if (!isAvailable) {
                // Deferred entry — track when it becomes available
                if (
                  earliestWake === null ||
                  entry.availableAt! < earliestWake
                ) {
                  earliestWake = entry.availableAt!;
                }
              }
              // Track TTL expiry
              if (entry.expiresAt !== null) {
                if (earliestWake === null || entry.expiresAt < earliestWake) {
                  earliestWake = entry.expiresAt;
                }
              }
              break;
            }
            case "running": {
              const ack = acks.get(entry.id);
              const nack = nacks.get(entry.id);
              const hb = heartbeats.get(entry.id);
              if (nack && ack) {
                ack.reject(new TurboqError("DoubleAck"));
                nack.resolvers.reject(new TurboqError("DoubleAck"));
                acks.delete(entry.id);
                nacks.delete(entry.id);
              } else if (ack) {
                entry.state = "done";
                ackedEntries.push(entry);
                ackAndNackResolvers.push(ack);
              } else if (nack) {
                entry.lastError = nack.error;
                const canRetry = entry.retryCount < entry.maxRetryCount;
                if (nack.markDead || !canRetry) {
                  entry.state = "dead";
                  deadEntries.push(entry);
                } else {
                  entry.state = "pending";
                  entry.retryCount++;
                  entry.lastHeartbeat = null;
                  retryEntries.push(entry);
                }
                nackedEntries.push(entry);
                ackAndNackResolvers.push(nack.resolvers);
              } else if (hb) {
                // Worker sent a heartbeat — update timestamp
                entry.lastHeartbeat = now;
                heartbeatedEntries.push(entry);
                ackAndNackResolvers.push(hb);
              } else {
                // No explicit operation on this running entry — check for timeout
                const lastHb = entry.lastHeartbeat ?? 0;
                const hbExpiresAt = lastHb + entry.heartbeatTimeout;
                if (now >= hbExpiresAt) {
                  const canRetry = entry.retryCount < entry.maxRetryCount;
                  if (canRetry) {
                    // Heartbeat expired — re-queue as pending
                    entry.state = "pending";
                    entry.retryCount++;
                    entry.lastHeartbeat = null;
                    timedOutEntries.push(entry);
                    retryEntries.push(entry);
                  } else {
                    // Heartbeat expired — mark as dead
                    entry.state = "dead";
                    deadEntries.push(entry);
                  }
                } else {
                  // Still running — track when heartbeat or TTL will expire
                  if (earliestWake === null || hbExpiresAt < earliestWake) {
                    earliestWake = hbExpiresAt;
                  }
                  if (entry.expiresAt !== null) {
                    if (
                      earliestWake === null || entry.expiresAt < earliestWake
                    ) {
                      earliestWake = entry.expiresAt;
                    }
                  }
                }
              }
              break;
            }
            case "done": {
              ackedEntries.push(entry);
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
          for (const [id, op] of this.#acks) {
            const existingAck = acks.get(id);
            if (existingAck) {
              existingAck.promise.then(op.resolve, op.reject);
            } else {
              acks.set(id, op);
            }
          }
          for (const [id, op] of this.#nacks) {
            const existingNack = nacks.get(id);
            if (existingNack) {
              existingNack.error = op.error;
              existingNack.markDead ||= op.markDead;
              const res = op.resolvers;
              existingNack.resolvers.promise.then(res.resolve, res.reject);
            } else {
              nacks.set(id, op);
            }
          }

          for (const [id, op] of this.#heartbeats) {
            const existingHeartbeat = heartbeats.get(id);
            if (existingHeartbeat) {
              existingHeartbeat.promise.then(op.resolve, op.reject);
            } else {
              heartbeats.set(id, op);
            }
          }

          // Clear globals for next iteration
          this.#pushes = [];
          this.#pops = [];
          this.#acks = new Map();
          this.#nacks = new Map();
          this.#heartbeats = new Map();

          // Exponential backoff before retry (50ms, 100ms, 200ms, ... capped at 1s)
          await new Promise((r) => setTimeout(r, Math.min(1000, 50 * 2 ** i)));
          continue casRetry;
        }

        for (let i = 0; i < pushes.length; i++) {
          pushes[i].resolvers.resolve(pushedEntries[i].id);
        }

        for (let i = 0; i < poppedEntries.length; i++) {
          const pop = pops[i];
          const poppedEntry = poppedEntries[i];
          pop.resolve(poppedEntry);
        }
        if (pops.length > poppedEntries.length) {
          this.#pops = pops.slice(poppedEntries.length).concat(this.#pops);
        }

        for (const r of ackAndNackResolvers) r.resolve();

        for (const ackedEntry of ackedEntries) acks.delete(ackedEntry.id);
        for (const [, ack] of acks) ack.reject(new TurboqError("InvalidEntry"));

        for (const nackedEntry of nackedEntries) nacks.delete(nackedEntry.id);
        for (const [, nack] of nacks) {
          nack.resolvers.reject(new TurboqError("InvalidEntry"));
        }

        for (const heartbeatedEntry of heartbeatedEntries) {
          heartbeats.delete(heartbeatedEntry.id);
        }
        for (const [, hb] of heartbeats) {
          hb.reject(new TurboqError("InvalidEntry"));
        }

        if (ackedEntries.length > 0) {
          this.dispatchEvent(new TurboqDoneEvent(ackedEntries as DoneEntry[]));
        }
        if (deadEntries.length > 0) {
          this.dispatchEvent(new TurboqDeadEvent(deadEntries as DeadEntry[]));
        }
        if (timedOutEntries.length > 0) {
          this.dispatchEvent(new TurboqTimeoutEvent(timedOutEntries));
        }
        if (pushedEntries.length > 0) {
          this.dispatchEvent(new TurboqPushEvent(pushedEntries));
        }
        if (poppedEntries.length > 0) {
          this.dispatchEvent(
            new TurboqClaimedEvent(poppedEntries as RunningEntry[]),
          );
        }
        if (retryEntries.length > 0) {
          this.dispatchEvent(
            new TurboqRetryEvent(retryEntries as PendingEntry[]),
          );
        }
        if (nackedEntries.length > 0) {
          this.dispatchEvent(new TurboqNackEvent(nackedEntries));
        }
        if (heartbeatedEntries.length > 0) {
          this.dispatchEvent(
            new TurboqHeartbeatEvent(heartbeatedEntries as RunningEntry[]),
          );
        }
        if (becameAvailableEntries.length > 0) {
          this.dispatchEvent(
            new TurboqAvailableEvent(becameAvailableEntries as PendingEntry[]),
          );
        }

        // Check for drain (queue is empty after processing)
        const pendingCount = queue.entries.filter(
          (e) => e.state === "pending" || e.state === "running",
        ).length;
        if (
          pendingCount === 0 &&
          (ackedEntries.length > 0 || deadEntries.length > 0)
        ) {
          this.dispatchEvent(new TurboqDrainEvent());
        }

        // Check for backpressure
        if (
          this.backpressureThreshold !== null &&
          queue.entries.length >= this.backpressureThreshold
        ) {
          this.dispatchEvent(
            new TurboqBackpressureEvent(
              queue.entries.length,
              this.backpressureThreshold,
            ),
          );
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
      this.dispatchEvent(
        new TurboqCommitFailedEvent({
          pushCount: pushes.length,
          popCount: pops.length,
          ackCount: acks.size,
          nackCount: nacks.size,
          heartbeatCount: heartbeats.size,
        }),
      );
      for (const op of pushes) {
        op.resolvers.reject(new TurboqError("CommitFailed"));
      }
      for (const op of pops) {
        op.reject(new TurboqError("CommitFailed"));
      }
      for (const op of acks.values()) {
        op.reject(new TurboqError("CommitFailed"));
      }
      for (const op of nacks.values()) {
        op.resolvers.reject(new TurboqError("CommitFailed"));
      }
      for (const op of heartbeats.values()) {
        op.reject(new TurboqError("CommitFailed"));
      }
    } finally {
      this.#acksInFlight = null;
      this.#nacksInFlight = null;
      this.#heartbeatsInFlight = null;
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
  expiresAt: number | null;
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
  push: TurboqPushEvent;
  claimed: TurboqClaimedEvent;
  retry: TurboqRetryEvent;
  nack: TurboqNackEvent;
  heartbeat: TurboqHeartbeatEvent;
  available: TurboqAvailableEvent;
  drain: TurboqDrainEvent;
  backpressure: TurboqBackpressureEvent;
  commitFailed: TurboqCommitFailedEvent;
};

export class TurboqDeadEvent extends CustomEvent<DeadEntry[]> {
  constructor(entries: DeadEntry[]) {
    super("dead", { detail: entries });
  }
}

export class TurboqDoneEvent extends CustomEvent<DoneEntry[]> {
  constructor(entries: DoneEntry[]) {
    super("done", { detail: entries });
  }
}

export class TurboqTimeoutEvent extends CustomEvent<Entry[]> {
  constructor(entries: Entry[]) {
    super("timeout", { detail: entries });
  }
}

export class TurboqPushEvent extends CustomEvent<PendingEntry[]> {
  constructor(entries: PendingEntry[]) {
    super("push", { detail: entries });
  }
}

export class TurboqClaimedEvent extends CustomEvent<RunningEntry[]> {
  constructor(entries: RunningEntry[]) {
    super("claimed", { detail: entries });
  }
}

export class TurboqRetryEvent extends CustomEvent<PendingEntry[]> {
  constructor(entries: PendingEntry[]) {
    super("retry", { detail: entries });
  }
}

export class TurboqNackEvent extends CustomEvent<Entry[]> {
  constructor(entries: Entry[]) {
    super("nack", { detail: entries });
  }
}

export class TurboqHeartbeatEvent extends CustomEvent<RunningEntry[]> {
  constructor(entries: RunningEntry[]) {
    super("heartbeat", { detail: entries });
  }
}

export class TurboqAvailableEvent extends CustomEvent<PendingEntry[]> {
  constructor(entries: PendingEntry[]) {
    super("available", { detail: entries });
  }
}

export class TurboqDrainEvent extends CustomEvent<void> {
  constructor() {
    super("drain");
  }
}

export class TurboqBackpressureEvent
  extends CustomEvent<{ depth: number; threshold: number }> {
  constructor(depth: number, threshold: number) {
    super("backpressure", { detail: { depth, threshold } });
  }
}

export class TurboqCommitFailedEvent extends CustomEvent<
  {
    pushCount: number;
    popCount: number;
    ackCount: number;
    nackCount: number;
    heartbeatCount: number;
  }
> {
  constructor(
    counts: {
      pushCount: number;
      popCount: number;
      ackCount: number;
      nackCount: number;
      heartbeatCount: number;
    },
  ) {
    super("commitFailed", { detail: counts });
  }
}

export const TurboqErrors = {
  CommitFailed: "Failed to commit the write operation to the storage backend",
  DoubleAck: "Cannot ack/nack entry twice",
  InvalidEntry: "Cannot ack/nack/heartbeat non existent entry",
  Closed: "Queue has been closed",
};

export class TurboqError<T extends keyof typeof TurboqErrors> extends Error {
  constructor(type: T) {
    super(TurboqErrors[type]);
    this.name = type;
  }
}
