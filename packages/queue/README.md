# @joyful/queue

A robust and flexible job queue system for Deno/TypeScript applications.

## Installation

To use this package in your Deno project, assuming it is published on JSR (Deno's JavaScript Registry) or available locally with a `deno.jsonc` file that defines its exports:

**Using JSR (recommended for published packages):**
Add the package to your `deno.jsonc` or `deno.json` file's `imports` section:
```json
{
  "imports": {
    "@joyful/queue": "jsr:@joyful/queue@^0.1.0"
  }
}
```
Then, in your code:
```typescript
import { Queue, QueueWorker } from "@joyful/queue";
import { MemoryBroker } from "@joyful/queue/memory";
```

**Using local path (if developing locally or package not on JSR):**
If you have the `@joyful/queue` package locally and its `deno.jsonc` is set up with exports, you can use relative paths from your project's `deno.jsonc` or directly if it's a local module. For example, if your project structure allows direct pathing or uses an import map:

```typescript
// Example assuming direct local import from a consuming project's deno.jsonc or similar setup
// This path might vary based on your project structure and how you map local modules.
// For this example, we'll use the JSR-style imports as if the package is consumed.
import { Queue, QueueWorker } from "@joyful/queue"; // Or "jsr:@joyful/queue"
import { MemoryBroker } from "@joyful/queue/memory"; // Or "jsr:@joyful/queue/memory"
```

## Basic Usage

Here's a basic example of how to use `@joyful/queue`. It uses the built-in `MemoryBroker`.

```typescript
// main.ts
import { Queue, QueueWorker } from "@joyful/queue";
import { MemoryBroker } from "@joyful/queue/memory";

// 1. Initialize the MemoryBroker
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

You can implement custom brokers to support various backends like Redis, PostgreSQL, RabbitMQ. The package includes a `MemoryBroker` which is useful for testing or simple single-process applications. This decouples the queue logic from the specific storage technology.

### `BackoffStrategy`

The `BackoffStrategy` defines how job retries are delayed when a job handler throws an error. This is crucial for handling transient failures gracefully without overwhelming downstream services or the jobs themselves. The available strategies are:

-   **`fixed`**: Retries happen after a fixed delay.
    -   `{ kind: "fixed", delay: 5000 }` (retries every 5 seconds)
-   **`linear`**: Retries happen with a delay that increases linearly with each attempt.
    -   `{ kind: "linear", delay: 1000 }` (1s, 2s, 3s, ...)
-   **`exponential`**: Retries happen with a delay that increases exponentially with each attempt. This is often the recommended strategy for many use cases.
    -   `{ kind: "exponential", delay: 1000, maxDelay: 60000 }` (e.g., 1s, 2s, 4s, 8s, ..., up to a max of 60s)

You can also specify `maxDelay` to cap the delay time and `jitter` (boolean) to add a random factor to the delay, which can help prevent thundering herd problems.
