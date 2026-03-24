import type { Storage, EntryId } from "./types.ts";
import { TypedEventTarget } from "./types.ts";

export type TurboqOptions = {
  maxRetryCount?: number;
  compactionThreshold?: number;
};

export type Entry = {
  id: EntryId;
  state: "pending" | "running" | "done" | "dead";
  retryCount: number;
  maxRetryCount: number;
  lastError: string | null;
  data: string;
};

type WalOp =
  | { op: "push"; id: EntryId; data: string; maxRetryCount: number }
  | { op: "pop"; id: EntryId }
  | { op: "ack"; id: EntryId }
  | { op: "nack"; id: EntryId; error: string; markDead: boolean };

type WalData = {
  ops: WalOp[];
};

type SnapshotData = {
  entries: Entry[];
};

type BufferedOp =
  | {
      kind: "push";
      data: string;
      maxRetryCount: number;
      resolvers: PromiseWithResolvers<EntryId>;
    }
  | { kind: "pop"; resolvers: PromiseWithResolvers<Entry> }
  | { kind: "ack"; id: EntryId; resolvers: PromiseWithResolvers<void> }
  | {
      kind: "nack";
      id: EntryId;
      error: string;
      markDead: boolean;
      resolvers: PromiseWithResolvers<void>;
    };

export class Turboq extends TypedEventTarget<TurboqEvents> {
  maxRetryCount: number;
  compactionThreshold: number;

  constructor(storage: Storage, options: TurboqOptions = {}) {
    super();
    this.#storage = storage;
    this.maxRetryCount = options.maxRetryCount ?? 5;
    this.compactionThreshold = options.compactionThreshold ?? 1000;
  }

  push(
    data: string,
    maxRetryCount: number = this.maxRetryCount,
  ): Promise<EntryId> {
    const resolvers = Promise.withResolvers<EntryId>();
    this.#ops.push({ kind: "push", data, maxRetryCount, resolvers });
    this.#scheduleCommit();
    return resolvers.promise;
  }

  pop(): Promise<Entry> {
    const resolvers = Promise.withResolvers<Entry>();
    this.#ops.push({ kind: "pop", resolvers });
    this.#scheduleCommit();
    return resolvers.promise;
  }

  ack(entryId: EntryId): Promise<void> {
    const resolvers = Promise.withResolvers<void>();
    this.#ops.push({ kind: "ack", id: entryId, resolvers });
    this.#scheduleCommit();
    return resolvers.promise;
  }

  nack(
    entryId: EntryId,
    error: string,
    markDead: boolean = false,
  ): Promise<void> {
    const resolvers = Promise.withResolvers<void>();
    this.#ops.push({ kind: "nack", id: entryId, error, markDead, resolvers });
    this.#scheduleCommit();
    return resolvers.promise;
  }

  #storage: Storage;
  #ops: BufferedOp[] = [];
  #unfulfilledPops: PromiseWithResolvers<Entry>[] = [];

  #entries: Map<EntryId, Entry> = new Map();
  #pendingQueue: EntryId[] = [];
  #loaded = false;

  #walEtag: string | undefined;
  #walOps: WalOp[] = [];

  #running: Promise<void> | null = null;
  #pendingCommit = false;
  #scheduled = false;

  #scheduleCommit() {
    if (this.#running) {
      this.#pendingCommit = true;
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
      this.#pendingCommit = false;
      await this.#commit();
      await Promise.resolve();
    } while (this.#pendingCommit || this.#hasPendingWork());
  }

  #hasPendingWork(): boolean {
    return this.#ops.some((op) => op.kind !== "pop");
  }

  async #commit() {
    if (!this.#loaded) {
      await this.#loadState();
    }

    const ops = this.#ops;
    this.#ops = [];

    const walOps: WalOp[] = [];
    const doneEntries: Entry[] = [];
    const deadEntries: Entry[] = [];
    const pushResolvers: Array<{
      id: EntryId;
      resolvers: PromiseWithResolvers<EntryId>;
    }> = [];
    const popResolvers: PromiseWithResolvers<Entry>[] = [];
    const ackResolvers: PromiseWithResolvers<void>[] = [];
    const nackResolvers: PromiseWithResolvers<void>[] = [];

    // Collect unfulfilled pops from previous rounds
    for (const pop of this.#unfulfilledPops) {
      popResolvers.push(pop);
    }
    this.#unfulfilledPops = [];

    for (const op of ops) {
      switch (op.kind) {
        case "push": {
          const id = crypto.randomUUID() as EntryId;
          const entry: Entry = {
            id,
            state: "pending",
            retryCount: 0,
            maxRetryCount: op.maxRetryCount,
            data: op.data,
            lastError: null,
          };
          this.#entries.set(id, entry);
          this.#pendingQueue.push(id);
          walOps.push({
            op: "push",
            id,
            data: op.data,
            maxRetryCount: op.maxRetryCount,
          });
          pushResolvers.push({ id, resolvers: op.resolvers });
          break;
        }
        case "pop": {
          popResolvers.push(op.resolvers);
          break;
        }
        case "ack": {
          const entry = this.#entries.get(op.id);
          if (!entry || entry.state !== "running") {
            op.resolvers.reject(
              new Error(`cannot ack entry ${op.id}: not running`),
            );
            break;
          }
          entry.state = "done";
          doneEntries.push(entry);
          walOps.push({ op: "ack", id: op.id });
          ackResolvers.push(op.resolvers);
          break;
        }
        case "nack": {
          const entry = this.#entries.get(op.id);
          if (!entry || entry.state !== "running") {
            op.resolvers.reject(
              new Error(`cannot nack entry ${op.id}: not running`),
            );
            break;
          }
          entry.lastError = op.error;
          entry.retryCount++;
          if (op.markDead || entry.retryCount >= entry.maxRetryCount) {
            entry.state = "dead";
            if (op.markDead) entry.retryCount -= 1;
            deadEntries.push(entry);
          } else {
            entry.state = "pending";
            this.#pendingQueue.push(entry.id);
          }
          walOps.push({
            op: "nack",
            id: op.id,
            error: op.error,
            markDead: op.markDead,
          });
          nackResolvers.push(op.resolvers);
          break;
        }
      }
    }

    // Fulfill pops from the pending queue
    const fulfilled: Array<{
      entry: Entry;
      resolvers: PromiseWithResolvers<Entry>;
    }> = [];
    while (popResolvers.length > 0 && this.#pendingQueue.length > 0) {
      const id = this.#pendingQueue.shift()!;
      const entry = this.#entries.get(id);
      if (!entry || entry.state !== "pending") continue;
      entry.state = "running";
      walOps.push({ op: "pop", id });
      fulfilled.push({ entry, resolvers: popResolvers.shift()! });
    }

    // Remaining pops stay unfulfilled
    this.#unfulfilledPops = popResolvers;

    // Nothing to write
    if (walOps.length === 0) return;

    this.#walOps.push(...walOps);
    const newWalData: WalData = { ops: this.#walOps };
    const writeResult = await this.#storage.putCAS(
      "wal.json",
      JSON.stringify(newWalData),
      this.#walEtag,
    );
    if (!writeResult) {
      throw new Error("CAS failed, another broker/writer is online. TODO");
    }
    this.#walEtag = writeResult;

    // Remove done/dead entries from in-memory state
    for (const entry of doneEntries) this.#entries.delete(entry.id);
    for (const entry of deadEntries) this.#entries.delete(entry.id);

    // Resolve all promises
    if (doneEntries.length > 0)
      this.dispatchEvent(new TurboqDoneEvent(doneEntries));
    if (deadEntries.length > 0)
      this.dispatchEvent(new TurboqDeadEvent(deadEntries));

    for (const { id, resolvers } of pushResolvers) resolvers.resolve(id);
    for (const { entry, resolvers } of fulfilled) resolvers.resolve(entry);
    for (const r of ackResolvers) r.resolve();
    for (const r of nackResolvers) r.resolve();

    // Compact if WAL is getting large
    if (this.#walOps.length >= this.compactionThreshold) {
      await this.#compact();
    }
  }

  async #loadState() {
    const snapshotObj = await this.#storage.get("snapshot.json");
    if (snapshotObj) {
      const snapshot = JSON.parse(snapshotObj.data) as SnapshotData;
      for (const entry of snapshot.entries) {
        this.#entries.set(entry.id, entry);
        if (entry.state === "pending") this.#pendingQueue.push(entry.id);
      }
    }

    const walObj = await this.#storage.get("wal.json");
    if (walObj) {
      const wal = JSON.parse(walObj.data) as WalData;
      this.#replayOps(wal.ops);
      this.#walEtag = walObj.etag;
      this.#walOps = wal.ops;
    }

    this.#loaded = true;
  }

  #replayOps(ops: WalOp[]) {
    for (const op of ops) {
      switch (op.op) {
        case "push": {
          const entry: Entry = {
            id: op.id,
            state: "pending",
            retryCount: 0,
            maxRetryCount: op.maxRetryCount,
            data: op.data,
            lastError: null,
          };
          this.#entries.set(op.id, entry);
          this.#pendingQueue.push(op.id);
          break;
        }
        case "pop": {
          const entry = this.#entries.get(op.id);
          if (entry && entry.state === "pending") {
            entry.state = "running";
            const idx = this.#pendingQueue.indexOf(op.id);
            if (idx !== -1) this.#pendingQueue.splice(idx, 1);
          }
          break;
        }
        case "ack": {
          const entry = this.#entries.get(op.id);
          if (entry) {
            this.#entries.delete(op.id);
          }
          break;
        }
        case "nack": {
          const entry = this.#entries.get(op.id);
          if (entry) {
            entry.lastError = op.error;
            entry.retryCount++;
            if (op.markDead || entry.retryCount >= entry.maxRetryCount) {
              entry.state = "dead";
              if (op.markDead) entry.retryCount -= 1;
              this.#entries.delete(entry.id);
            } else {
              entry.state = "pending";
              this.#pendingQueue.push(entry.id);
            }
          }
          break;
        }
      }
    }
  }

  async #compact() {
    const entries = Array.from(this.#entries.values()).filter(
      (e) => e.state !== "done" && e.state !== "dead",
    );
    const snapshot: SnapshotData = { entries };

    // Write new snapshot
    const snapshotObj = await this.#storage.get("snapshot.json");
    const snapshotResult = await this.#storage.putCAS(
      "snapshot.json",
      JSON.stringify(snapshot),
      snapshotObj?.etag,
    );
    if (!snapshotResult) return; // Compaction failed, try next time

    // Clear WAL
    const clearWal: WalData = { ops: [] };
    const walResult = await this.#storage.putCAS(
      "wal.json",
      JSON.stringify(clearWal),
      this.#walEtag,
    );
    if (walResult) {
      this.#walEtag = walResult;
      this.#walOps = [];
    }
  }
}

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
