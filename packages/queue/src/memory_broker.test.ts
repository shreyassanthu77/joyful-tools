import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { MemoryBroker } from "./memory_broker.ts";
import { Job } from "./queue.ts";

Deno.test("MemoryBroker - enqueue and dequeue", async () => {
  const broker = new MemoryBroker();
  const queueName = "test-queue-1";
  const jobPayload = { task: "send_email", userId: 123 };
  const job: Job<unknown> = {
    id: "job1",
    type: "email",
    payload: jobPayload,
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date(),
  };

  await broker.enqueue(queueName, job);
  const dequeuedJob = await broker.dequeue(queueName);

  assertExists(dequeuedJob);
  assertEquals(dequeuedJob.id, job.id);
  assertEquals(dequeuedJob.payload, jobPayload);
  if (dequeuedJob) await broker.completeJob(queueName, dequeuedJob.id); // Prevent leak
});

Deno.test("MemoryBroker - dequeue from empty queue", async () => {
  const broker = new MemoryBroker();
  const queueName = "test-queue-empty";

  const dequeuedJob = await broker.dequeue(queueName);
  assertEquals(dequeuedJob, null);
});

Deno.test("MemoryBroker - completeJob", async () => {
  const broker = new MemoryBroker();
  const queueName = "test-queue-complete";
  const job: Job<unknown> = {
    id: "job-complete",
    type: "task",
    payload: { data: "some_data" },
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date(),
  };

  await broker.enqueue(queueName, job);
  let dequeuedJob = await broker.dequeue(queueName);
  assertExists(dequeuedJob);
  assertEquals(dequeuedJob.id, "job-complete");

  await broker.completeJob(queueName, dequeuedJob.id);
  dequeuedJob = await broker.dequeue(queueName); // Try to dequeue again
  assertEquals(dequeuedJob, null, "Job should be null after completion");
});

Deno.test("MemoryBroker - failJob", async () => {
  const broker = new MemoryBroker();
  const queueName = "test-queue-fail";
  const job: Job<unknown> = {
    id: "job-fail",
    type: "task",
    payload: { data: "critical_data" },
    attempts: 3, // Max attempts reached
    maxAttempts: 3,
    createdAt: new Date(),
  };

  await broker.enqueue(queueName, job);
  let dequeuedJob = await broker.dequeue(queueName);
  assertExists(dequeuedJob);
  assertEquals(dequeuedJob.id, "job-fail");

  await broker.failJob(queueName, dequeuedJob.id, "Simulated critical failure");
  dequeuedJob = await broker.dequeue(queueName); // Try to dequeue again
  assertEquals(dequeuedJob, null, "Job should be null after failing (and removal by MemoryBroker)");
});

Deno.test("MemoryBroker - delayed job", async (t) => {
  const broker = new MemoryBroker();
  const queueName = "test-queue-delay";
  const delayMs = 100;
  const job: Job<unknown> = {
    id: "job-delay",
    type: "delayedTask",
    payload: { data: "wait_for_it" },
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date(),
  };

  await broker.enqueue(queueName, job, delayMs);

  // Immediately try to dequeue, should be null
  let dequeuedJob = await broker.dequeue(queueName);
  assertEquals(dequeuedJob, null, "Job should be null immediately after enqueuing with delay");

  // Wait for the delay duration
  await new Promise(resolve => setTimeout(resolve, delayMs + 50)); // add a little buffer

  dequeuedJob = await broker.dequeue(queueName);
  assertExists(dequeuedJob, "Job should be available after delay");
  if (!dequeuedJob) throw new Error("dequeuedJob should exist"); // Type guard
  assertEquals(dequeuedJob.id, job.id);
  if (dequeuedJob) await broker.completeJob(queueName, dequeuedJob.id); // Prevent leak
});


Deno.test("MemoryBroker - job processing timeout", async (t) => {
    const broker = new MemoryBroker();
    // Temporarily shorten the processing timeout for this test
    broker._setProcessingTimeoutMs(50);
    const queueName = "test-queue-timeout";
    const job: Job<unknown> = {
        id: "job-timeout",
        type: "longTask",
        payload: { data: "will_timeout" },
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
    };

    await broker.enqueue(queueName, job);

    // Dequeue the job, it's now "processing"
    let dequeuedJob = await broker.dequeue(queueName);
    assertExists(dequeuedJob);
    if (!dequeuedJob) throw new Error("dequeuedJob should exist"); // Type guard
    assertEquals(dequeuedJob.id, job.id);

    // Try to dequeue again immediately, should be null as it's "processing"
    let sameJob = await broker.dequeue(queueName);
    assertEquals(sameJob, null, "Job should be null as it is currently being processed");

    // Wait for longer than the processing timeout
    // This part of the test will require the setter for #processingTimeoutMs
    // For now, assuming it's set via a new method in MemoryBroker
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for 100ms, timeout is 50ms

    // The job should have been released and be available again
    const releasedJob = await broker.dequeue(queueName);
    assertExists(releasedJob, "Job should be available again after processing timeout");
    if (!releasedJob) throw new Error("releasedJob should exist"); // Type guard
    assertEquals(releasedJob.id, job.id);
    if (releasedJob) await broker.completeJob(queueName, releasedJob.id); // Prevent leak
});

Deno.test("MemoryBroker - FIFO processing", async () => {
  const broker = new MemoryBroker();
  const queueName = "test-queue-fifo";
  const job1: Job<unknown> = { id: "job1-fifo", type: "fifo", payload: {}, attempts: 0, maxAttempts: 1, createdAt: new Date() };
  const job2: Job<unknown> = { id: "job2-fifo", type: "fifo", payload: {}, attempts: 0, maxAttempts: 1, createdAt: new Date(Date.now() + 1) }; // ensure different creation time if used for sorting

  await broker.enqueue(queueName, job1);
  await broker.enqueue(queueName, job2);

  const dequeuedJob1 = await broker.dequeue(queueName);
  assertExists(dequeuedJob1);
  if (!dequeuedJob1) throw new Error("dequeuedJob1 should exist"); // Type guard
  assertEquals(dequeuedJob1.id, "job1-fifo");

  const dequeuedJob2 = await broker.dequeue(queueName);
  assertExists(dequeuedJob2);
  if (!dequeuedJob2) throw new Error("dequeuedJob2 should exist"); // Type guard
  assertEquals(dequeuedJob2.id, "job2-fifo");

  // Prevent leaks by completing the jobs
  if (dequeuedJob1) await broker.completeJob(queueName, dequeuedJob1.id);
  if (dequeuedJob2) await broker.completeJob(queueName, dequeuedJob2.id);
});
