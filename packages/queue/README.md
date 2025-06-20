# @joyful/queue

A robust and flexible job queue system for Deno/TypeScript applications.

## Installation

To use this package in your Deno project, you can import it directly from its URL (e.g., a GitHub raw URL or a Deno Land URL once published).

```typescript
// main.ts
import { Queue, QueueWorker } from "https://deno.land/x/joyful_queue/mod.ts"; // Replace with the actual URL once published
// Or, if you have it locally or as a submodule:
// import { Queue, QueueWorker } from "./packages/queue/src/mod.ts"; // Adjust path as needed
```

## Basic Usage

Here's a basic example of how to use `@joyful/queue` with a hypothetical `MemoryBroker`.

First, you would need a broker implementation. For this example, let's assume a simple `MemoryBroker` (you'd need to implement this or use a pre-built one for a specific backend).

```typescript
// memory_broker.ts (Hypothetical example)
import { Broker, Job } from "https://deno.land/x/joyful_queue/mod.ts"; // Adjust import path

export class MemoryBroker implements Broker {
  private queues: Map<string, Job<unknown>[]> = new Map();
  private jobData: Map<string, Job<unknown>> = new Map();

  async enqueue(queueName: string, job: Job<unknown>, delay?: number): Promise<void> {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    this.jobData.set(job.id, job);

    if (delay && delay > 0) {
      setTimeout(() => {
        this.queues.get(queueName)!.push(job);
      }, delay);
    } else {
      this.queues.get(queueName)!.push(job);
    }
    console.log(`Job ${job.id} enqueued to ${queueName}.`);
  }

  async dequeue(queueName: string): Promise<Job<unknown> | null> {
    const queue = this.queues.get(queueName);
    if (queue && queue.length > 0) {
      const job = queue.shift();
      if (job) {
        console.log(`Job ${job.id} dequeued from ${queueName}.`);
        return this.jobData.get(job.id) || null;
      }
    }
    return null;
  }

  async completeJob(queueName: string, id: string): Promise<void> {
    const job = this.jobData.get(id);
    if (job) {
      job.processedAt = new Date();
      // In a real broker, you might move this to a completed set or remove it
      console.log(`Job ${id} in ${queueName} marked as complete.`);
    }
  }

  async failJob(queueName: string, id: string, error: string): Promise<void> {
    const job = this.jobData.get(id);
    if (job) {
      job.failedAt = new Date();
      job.error = error;
      // In a real broker, you might move this to a failed set or handle retries
      console.log(`Job ${id} in ${queueName} marked as failed: ${error}`);
    }
  }
}
```

Now, you can use the `Queue` and `QueueWorker`:

```typescript
// main.ts
import { Queue, QueueWorker } from "https://deno.land/x/joyful_queue/mod.ts"; // Adjust import path
import { MemoryBroker } from "./memory_broker.ts"; // Assuming a local MemoryBroker

// 1. Initialize a broker
const broker = new MemoryBroker();

// 2. Create a queue
// The type parameter <string> indicates the payload type for this queue.
const myQueue = new Queue<string>("email-queue", broker);

// 3. Enqueue a job
async function addJob() {
  const jobId = await myQueue.enqueue(
    "send-welcome-email",    // Job type
    "user@example.com",      // Job payload
    { maxAttempts: 5 }       // Options
  );
  console.log(`Job enqueued with ID: ${jobId}`);
}

addJob();

// 4. Create a worker
const worker = new QueueWorker({
  queue: myQueue,
  broker: broker,
  backoff: { kind: "exponential", delay: 1000, maxDelay: 60000 } // Optional backoff strategy
});

// 5. Register a handler for a job type
worker.on("send-welcome-email", async (job) => {
  console.log(`Processing job ${job.id} (attempt ${job.attempts}) for payload: ${job.payload}`);
  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, 2000));

  if (Math.random() < 0.3 && job.attempts < job.maxAttempts) { // Simulate occasional failure
    console.warn(`Job ${job.id} failed (simulated). It will be retried.`);
    throw new Error("Failed to send email (simulated)");
  }
  console.log(`Job ${job.id} completed successfully.`);
});

// 6. Start the worker
worker.start();
console.log("Worker started, listening for jobs on email-queue...");

// To demonstrate graceful shutdown (optional):
// setTimeout(async () => {
//   console.log("Stopping worker...");
//   await worker.stop();
//   console.log("Worker stopped.");
//   // In a real application, you might also want to close the broker connection here.
// }, 20000); // Stop after 20 seconds for demo
```

## Key Concepts

### `Broker`

The `Broker` is an interface that defines the contract for message storage and retrieval. It's responsible for the underlying mechanics of how jobs are persisted, dequeued for processing, and how their state (completed, failed) is updated.

You can implement custom brokers to support various backends like Redis, PostgreSQL, RabbitMQ, or even a simple in-memory broker for testing (as shown in the example). This decouples the queue logic from the specific storage technology.

### `BackoffStrategy`

The `BackoffStrategy` defines how job retries are delayed when a job handler throws an error. This is crucial for handling transient failures gracefully without overwhelming downstream services or the jobs themselves. The available strategies are:

-   **`fixed`**: Retries happen after a fixed delay.
    -   `{ kind: "fixed", delay: 5000 }` (retries every 5 seconds)
-   **`linear`**: Retries happen with a delay that increases linearly with each attempt.
    -   `{ kind: "linear", delay: 1000 }` (1s, 2s, 3s, ...)
-   **`exponential`**: Retries happen with a delay that increases exponentially with each attempt. This is often the recommended strategy for many use cases.
    -   `{ kind: "exponential", delay: 1000, maxDelay: 60000 }` (e.g., 1s, 2s, 4s, 8s, ..., up to a max of 60s)

You can also specify `maxDelay` to cap the delay time and `jitter` (boolean) to add a random factor to the delay, which can help prevent thundering herd problems.
