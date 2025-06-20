/**
 * Represents a job to be processed in the queue.
 * @template T The type of the job payload.
 */
export type Job<T> = {
  /** The unique identifier of the job. */
  id: string;
  /** The type of the job, used to determine the handler. */
  type: string;
  /** The payload of the job. */
  payload: T;
  /** The number of times the job has been attempted. */
  attempts: number;
  /** The maximum number of times the job can be attempted. */
  maxAttempts: number;
  /** The date and time the job was created. */
  createdAt: Date;
  /** The date and time the job was processed. */
  processedAt?: Date;
  /** The date and time the job failed. */
  failedAt?: Date;
  /** The error message if the job failed. */
  error?: string;
};

/**
 * Represents a message broker that can enqueue and dequeue jobs.
 */
export interface Broker {
  /**
   * Enqueues a job to the specified queue.
   * @param queue The name of the queue.
   * @param job The job to enqueue.
   * @param delay The delay in milliseconds before the job should be processed.
   */
  enqueue(queue: string, job: Job<unknown>, delay?: number): Promise<void>;
  /**
   * Dequeues a job from the specified queue.
   * @param queue The name of the queue.
   * @returns A promise that resolves to the job, or null if the queue is empty.
   */
  dequeue(queue: string): Promise<Job<unknown> | null>;
  /**
   * Marks a job as complete.
   * @param queue The name of the queue.
   * @param id The ID of the job to complete.
   */
  completeJob(queue: string, id: string): Promise<void>;
  /**
   * Marks a job as failed.
   * @param queue The name of the queue.
   * @param id The ID of the job to fail.
   * @param error The error message.
   */
  failJob(queue: string, id: string, error: string): Promise<void>;
}

/**
 * Represents a backoff strategy for retrying failed jobs.
 */
export interface BackoffStrategy {
  /** The kind of backoff strategy. */
  kind: "fixed" | "linear" | "exponential";
  /** The delay in milliseconds. */
  delay: number;
  /** The maximum delay in milliseconds. */
  maxDelay?: number;
  /** Whether to apply jitter to the delay. */
  jitter?: boolean;
}

/**
 * Represents options for enqueuing a job.
 */
export interface EnqueueOptions {
  /** The maximum number of times the job can be attempted. */
  maxAttempts?: number;
  /** The delay in milliseconds before the job should be processed. */
  delay?: number;
}

/**
 * Represents a queue that can enqueue jobs.
 * @template T The type of the job payload.
 */
export class Queue<T> {
  #name: string;
  /** The name of the queue. */
  get name(): string {
    return this.#name;
  }

  #broker: Broker;

  /**
   * Creates a new queue.
   * @param name The name of the queue.
   * @param broker The broker to use for enqueuing jobs.
   */
  constructor(name: string, broker: Broker) {
    this.#name = name;
    this.#broker = broker;
  }

  /**
   * Enqueues a job to the queue.
   * @param type The type of the job.
   * @param payload The payload of the job.
   * @param options The options for enqueuing the job.
   * @returns A promise that resolves to the ID of the job.
   */
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

/**
 * Represents options for creating a queue worker.
 * @template Q The type of the queue.
 */
export interface WorkerOptions<Q extends Queue<unknown>> {
  /** The queue to process jobs from. */
  queue: Q;
  /** The broker to use for dequeuing jobs. */
  broker: Broker;
  /** The backoff strategy for retrying failed jobs. */
  backoff?: BackoffStrategy;
}

/**
 * Represents a queue worker that processes jobs from a queue.
 * @template Q The type of the queue.
 * @template T The type of the job payload.
 */
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

  /**
   * Creates a new queue worker.
   * @param options The options for creating the queue worker.
   */
  constructor({ queue, broker, backoff }: WorkerOptions<Q>) {
    this.#queue = queue;
    this.#broker = broker;
    this.#backoff = backoff ?? { kind: "fixed", delay: 1000 };
  }

  /**
   * Registers a handler for a job type.
   * @param type The type of the job.
   * @param handler The handler for the job.
   * @param override Whether to override an existing handler for the job type.
   * @returns True if the handler was registered, false otherwise.
   */
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

  /**
   * Unregisters a handler for a job type.
   * @param type The type of the job.
   * @returns True if the handler was unregistered, false otherwise.
   */
  off(type: string): boolean {
    if (!this.#handlers.has(type)) {
      return false;
    }
    this.#handlers.delete(type);
    return true;
  }

  /**
   * Starts the queue worker.
   * @returns True if the worker was started, false otherwise.
   */
  start(): boolean {
    if (this.#running) return true;
    this.#running = true;

    this.#startProcessing().catch((e) => {
      console.error(e);
    });
    return true;
  }

  /**
   * Stops the queue worker.
   * @returns A promise that resolves when the worker has stopped.
   */
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
