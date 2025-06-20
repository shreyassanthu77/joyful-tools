export type Job<T> = {
  id: string;
  type: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  error?: string;
};

export interface Broker {
  enqueue(queue: string, job: Job<unknown>, delay?: number): Promise<void>;
  dequeue(queue: string): Promise<Job<unknown> | null>;
  completeJob(queue: string, id: string): Promise<void>;
  failJob(queue: string, id: string, error: string): Promise<void>;
}

export interface BackoffStrategy {
  kind: "fixed" | "linear" | "exponential";
  delay: number;
  maxDelay?: number;
  jitter?: boolean;
}

export interface EnqueueOptions {
  maxAttempts?: number;
  delay?: number;
}

export class Queue<T> {
  #name: string;
  get name(): string {
    return this.#name;
  }

  #broker: Broker;

  constructor(name: string, broker: Broker) {
    this.#name = name;
    this.#broker = broker;
  }

  async enqueue(
    type: string,
    payload: T,
    options: EnqueueOptions = {},
  ): Promise<string> {
    const { maxAttempts = 3, delay } = options;
    const id = crypto.randomUUID();
    const job: Job<T> = {
      id,
      type,
      payload,
      attempts: 0,
      maxAttempts,
      createdAt: new Date(),
    };
    await this.#broker.enqueue(this.#name, job, delay);
    return id;
  }
}

export interface WorkerOptions<Q extends Queue<unknown>> {
  queue: Q;
  broker: Broker;
  backoff?: BackoffStrategy;
}

export class QueueWorker<
  // deno-lint-ignore no-explicit-any
  Q extends Queue<any>,
  T = Q extends Queue<infer T> ? T : unknown,
> {
  #queue: Q;
  #broker: Broker;
  #backoff: BackoffStrategy;
  #running = false;
  #handlers = new Map<string, (job: Job<T>) => Promise<void>>();
  #processing = new Set<string>();

  constructor({ queue, broker, backoff }: WorkerOptions<Q>) {
    this.#queue = queue;
    this.#broker = broker;
    this.#backoff = backoff ?? { kind: "fixed", delay: 1000 };
  }

  on(
    type: string,
    handler: (job: Job<T>) => Promise<void>,
    override?: boolean,
  ): boolean {
    if (this.#handlers.has(type) && !override) {
      return false;
    }
    if (override) {
      this.#handlers.delete(type);
    }
    this.#handlers.set(type, handler);
    return true;
  }

  off(type: string): boolean {
    if (!this.#handlers.has(type)) {
      return false;
    }
    this.#handlers.delete(type);
    return true;
  }

  start(): boolean {
    if (this.#running) return true;
    this.#running = true;

    this.#startProcessing().catch((e) => {
      console.error(e);
    });
    return true;
  }

  async stop(): Promise<void> {
    this.#running = false;
    while (this.#processing.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async #startProcessing(): Promise<void> {
    while (this.#running) {
      const job = (await this.#broker.dequeue(this.#queue.name)) as Job<T>;
      if (!job) continue;

      this.#processing.add(job.id);
      await this.#run(job);
      this.#processing.delete(job.id);
    }
  }

  async #run(job: Job<T>): Promise<void> {
    const handler = this.#handlers.get(job.type);
    if (!handler) {
      await this.#broker.failJob(
        this.#queue.name,
        job.id,
        `No handler found for job type: ${job.type}`,
      );
      return;
    }

    job.attempts++;
    job.processedAt = new Date();

    try {
      await handler(job);
      await this.#broker.completeJob(this.#queue.name, job.id);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (job.attempts >= job.maxAttempts) {
        await this.#broker.failJob(this.#queue.name, job.id, error);
        return;
      }

      const delay = calculateDelay(job.attempts, this.#backoff);
      await this.#broker.enqueue(this.#queue.name, job, delay);
    }
  }
}

const backoffStrategies = {
  fixed(delay: number) {
    return delay;
  },
  linear(n: number, delay: number, maxDelay?: number) {
    const result = delay * n;
    if (maxDelay && result > maxDelay) {
      return maxDelay;
    }
    return result;
  },
  exponential(n: number, delay: number, maxDelay?: number) {
    const result = delay * Math.pow(2, n - 1);
    if (maxDelay && result > maxDelay) {
      return maxDelay;
    }
    return result;
  },
};

function calculateDelay(
  attempt: number,
  { kind, delay, maxDelay, jitter }: BackoffStrategy,
): number {
  const result = backoffStrategies[kind](attempt, delay, maxDelay);
  if (jitter) {
    const jitterFactor = Math.random() * 0.5;
    return result * (1 + jitterFactor);
  }
  return Math.floor(result);
}
