import { Broker, Job } from "./queue.ts";

interface StoredJob<T> extends Job<T> {
  queueName: string;
  isProcessing?: boolean;
  processTimeout?: number; // Store timeout ID for processing
}

/**
 * A simple in-memory broker implementation for the queue system.
 * Useful for testing, development, or single-process applications.
 *
 * NOTE: This broker is not suitable for production environments involving multiple processes or persistence requirements.
 */
export class MemoryBroker implements Broker {
  #jobs: Map<string, StoredJob<unknown>[]> = new Map();
  #processingTimeoutMs = 30 * 1000; // 30 seconds default timeout for a job being processed

  /**
   * FOR TESTING PURPOSES ONLY: Sets the processing timeout for jobs.
   * @param ms The timeout in milliseconds.
   */
  _setProcessingTimeoutMs(ms: number): void {
    this.#processingTimeoutMs = ms;
  }

  /**
   * Enqueues a job into the specified queue.
   * @param queue The name of the queue.
   * @param job The job to enqueue.
   * @param delay Optional delay in milliseconds before the job is available for processing.
   */
  async enqueue(
    queueName: string,
    job: Job<unknown>,
    delay?: number,
  ): Promise<void> {
    if (!this.#jobs.has(queueName)) {
      this.#jobs.set(queueName, []);
    }
    const queue = this.#jobs.get(queueName)!;
    const storedJob: StoredJob<unknown> = { ...job, queueName };

    if (delay && delay > 0) {
      setTimeout(() => {
        storedJob.processedAt = undefined; // Reset processedAt if it was a retry
        storedJob.failedAt = undefined; // Reset failedAt
        storedJob.error = undefined;
        queue.push(storedJob);
      }, delay);
    } else {
      queue.push(storedJob);
    }
  }

  /**
   * Dequeues a job from the specified queue.
   * Marks the job as processing and sets a timeout to release it if not completed or failed.
   * @param queueName The name of the queue.
   * @returns A job or null if the queue is empty or all jobs are currently being processed.
   */
  async dequeue(queueName: string): Promise<Job<unknown> | null> {
    const queue = this.#jobs.get(queueName);
    if (!queue || queue.length === 0) {
      return null;
    }

    const jobIndex = queue.findIndex((j) => !j.isProcessing && (!j.processedAt || j.failedAt));
    if (jobIndex === -1) {
      return null; // No available jobs
    }

    const job = queue[jobIndex];
    job.isProcessing = true;

    // Set a timeout to handle cases where the worker crashes before completing/failing
    job.processTimeout = setTimeout(() => {
      if (job.isProcessing) { // Still processing after timeout
        job.isProcessing = false;
        // Optionally, increment a specific timeout counter or log this event
        // For simplicity, we just make it available again.
        // A more robust implementation might move it to a failed state or similar.
        console.warn(`Job ${job.id} in queue ${queueName} timed out and was re-released.`);
      }
    }, this.#processingTimeoutMs) as unknown as number;


    // Return a copy to prevent direct modification of broker's internal state by worker,
    // except for properties we explicitly manage (isProcessing, processTimeout).
    const { queueName: _q, isProcessing: _ip, processTimeout: _pt, ...returnJob } = job;
    return returnJob;
  }

  /**
   * Marks a job as complete, removing it from the queue.
   * @param queueName The name of the queue.
   * @param id The ID of the job to complete.
   */
  async completeJob(queueName: string, id: string): Promise<void> {
    const queue = this.#jobs.get(queueName);
    if (!queue) return;

    const jobIndex = queue.findIndex((j) => j.id === id);
    if (jobIndex !== -1) {
      const job = queue[jobIndex];
      if (job.processTimeout) clearTimeout(job.processTimeout);
      queue.splice(jobIndex, 1);
    }
  }

  /**
   * Marks a job as failed. In this basic MemoryBroker, it simply removes the job.
   * A more sophisticated MemoryBroker might move it to a separate "failed jobs" list
   * or update its status without removing if it's meant to be retried by the worker logic externally.
   * However, the current worker logic handles retries by re-enqueueing with delay.
   * So, if failJob is called, it means maxAttempts has been reached.
   * @param queueName The name of the queue.
   * @param id The ID of the job that failed.
   * @param error The error message.
   */
  async failJob(queueName: string, id: string, error: string): Promise<void> {
    const queue = this.#jobs.get(queueName);
    if (!queue) return;

    const jobIndex = queue.findIndex((j) => j.id === id);
    if (jobIndex !== -1) {
      const job = queue[jobIndex];
      if (job.processTimeout) clearTimeout(job.processTimeout);
      // For this broker, failing a job after max attempts (as per worker logic) means removing it.
      // The worker itself sets job.failedAt and job.error before calling broker.failJob
      // if it's the final failure.
      console.log(`Job ${id} failed with error: ${error} and was removed from queue ${queueName}.`);
      queue.splice(jobIndex, 1);
    }
  }
}
